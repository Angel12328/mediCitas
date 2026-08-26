// Tests del módulo de citas: reserva con bloqueo optimista, capacidad,
// posiciones en cola, transiciones por rol y observaciones (tareas 11.1–11.6)
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../src/app.js';
import { prisma } from '../../../src/shared/database/client.js';
import { signAccessToken } from '../../../src/modules/auth/token.service.js';
import { purgeTestUsers, uniqueDni, uniqueEmail } from '../../helpers/test-utils.js';

let app: ReturnType<typeof buildApp>;
const adminId = '00000000-0000-4000-8000-0000000000a7';
const PASSWORD = 'ClaveCitas123';

function adminToken(): Record<string, string> {
  return { authorization: `Bearer ${signAccessToken({ sub: adminId, roles: ['ADMIN'] })}` };
}
function tokenFor(sub: string, roles: string[]): Record<string, string> {
  return { authorization: `Bearer ${signAccessToken({ sub, roles })}` };
}

interface FixtureUser {
  userId: string;
  email: string;
}
const patientA: FixtureUser = { userId: '', email: '' };
const patientB: FixtureUser = { userId: '', email: '' };
const patientC: FixtureUser = { userId: '', email: '' };
let doctorUserId = '';
let doctorRecordId = '';
let cardiologyId = '';

let mainScheduleId = ''; // capacidad 2
let queueScheduleId = ''; // capacidad 5 (pruebas de cola)
let raceScheduleId = ''; // capacidad 1 (prueba de concurrencia)
let availabilityDate = '';

const createdAppointmentIds: string[] = [];

function nextMondayIso(): string {
  const now = new Date();
  const jsDay = now.getUTCDay();
  const diff = ((8 - jsDay) % 7 || 7) + 7;
  return new Date(now.getTime() + diff * 86400000).toISOString().slice(0, 10);
}

async function emailsOf(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true },
  });
  return user.email;
}

async function registerPatient(prefix: string): Promise<FixtureUser> {
  const email = uniqueEmail(prefix);
  const country = await prisma.country.findFirstOrThrow({ where: { name: 'Honduras' } });
  const department = await prisma.department.findFirstOrThrow({
    where: { name: 'Francisco Morazán' },
  });
  const municipality = await prisma.municipality.findFirstOrThrow({
    where: { name: 'Tegucigalpa', departmentId: department.id },
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      email,
      password: PASSWORD,
      accountType: 'PATIENT',
      bloodType: 'O_POSITIVE',
      person: {
        firstName: `Pac-${prefix}`,
        lastName: 'De Citas',
        birthDate: '1990-10-10',
        dni: uniqueDni('CIT'),
        gender: 'F',
        countryId: country.id,
        departmentId: department.id,
        municipalityId: municipality.id,
      },
    },
  });
  expect(response.statusCode).toBe(201);
  return { userId: JSON.parse(response.body).user.id, email };
}

async function book(
  headers: Record<string, string>,
  scheduleIdOverride?: string
): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/appointments',
    headers,
    payload: { scheduleId: scheduleIdOverride ?? mainScheduleId, date: availabilityDate },
  });
  if (response.statusCode === 201) {
    createdAppointmentIds.push((JSON.parse(response.body) as { id: string }).id);
  }
  return { statusCode: response.statusCode, body: JSON.parse(response.body) };
}

function setStatus(
  appointmentId: string,
  status: string,
  headers: Record<string, string> = adminToken()
) {
  return app.inject({
    method: 'PATCH',
    url: `/api/v1/appointments/${appointmentId}/status`,
    headers,
    payload: { status },
  });
}

/** Parsea el cuerpo JSON de una respuesta inject */
function json(response: { body: string }): Record<string, unknown> {
  return JSON.parse(response.body) as Record<string, unknown>;
}

beforeAll(async () => {
  app = buildApp();
  await purgeTestUsers();

  patientA.userId = ''; // se asignan abajo
  Object.assign(patientA, await registerPatient('cita-a'));
  Object.assign(patientB, await registerPatient('cita-b'));
  Object.assign(patientC, await registerPatient('cita-c'));

  // Doctor fixture: usuario → empleado → doctor
  const docUser = await registerPatient('cita-doc');
  doctorUserId = docUser.userId;
  const employee = await app.inject({
    method: 'POST',
    url: '/api/v1/employees',
    headers: adminToken(),
    payload: { userId: doctorUserId },
  });
  const doctor = await app.inject({
    method: 'POST',
    url: '/api/v1/doctors',
    headers: adminToken(),
    payload: { employeeId: JSON.parse(employee.body).id },
  });
  doctorRecordId = JSON.parse(doctor.body).id;

  cardiologyId = (
    await prisma.specialty.findFirstOrThrow({ where: { name: 'Cardiología' } })
  ).id;
  await app.inject({
    method: 'POST',
    url: `/api/v1/doctors/${doctorRecordId}/specialties`,
    headers: adminToken(),
    payload: { specialtyId: cardiologyId },
  });

  // Tres horarios LUNES sin solaparse entre sí
  availabilityDate = nextMondayIso();
  const LUNES = 1 << 0;
  const configs: Array<{ start: string; end: string; cap: number }> = [
    { start: '08:00', end: '12:00', cap: 2 }, // main
    { start: '13:00', end: '17:00', cap: 50 }, // cola (amplia para no acoplar tests)
    { start: '18:00', end: '20:00', cap: 1 }, // carrera
  ];
  const ids: string[] = [];
  for (const cfg of configs) {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/schedules',
      headers: adminToken(),
      payload: {
        doctorId: doctorRecordId,
        specialtyId: cardiologyId,
        daysBitmask: LUNES,
        startTime: cfg.start,
        endTime: cfg.end,
        slotCapacity: cfg.cap,
      },
    });
    expect(created.statusCode).toBe(201);
    ids.push(JSON.parse(created.body).id as string);
  }
  [mainScheduleId, queueScheduleId, raceScheduleId] = ids;
});

afterAll(async () => {
  await prisma.appointment.deleteMany({ where: { id: { in: createdAppointmentIds } } });
  await purgeTestUsers();
  await app.close();
  await prisma.$disconnect();
});

describe('11.1 reserva con capacidad y bloqueo optimista', () => {
  it('paciente reserva en horario del día correcto → PENDING', async () => {
    const result = await book(tokenFor(patientA.userId, ['PATIENT']));
    expect(result.statusCode).toBe(201);
    expect(result.body['status']).toBe('PENDING');
    expect(result.body['position']).toBe(1);
  });

  it('doble reserva del mismo paciente genera CONFLICT', async () => {
    const result = await book(tokenFor(patientA.userId, ['PATIENT']));
    expect(result.statusCode).toBe(409);
    expect(String(result.body['detail'])).toContain('Ya tienes');
  });

  it('segundo paciente ocupa posición 2; tercero rechazado por cupo completo', async () => {
    const ok = await book(tokenFor(patientB.userId, ['PATIENT']));
    expect(ok.statusCode).toBe(201);
    expect(ok.body['position']).toBe(2);

    const full = await book(tokenFor(patientC.userId, ['PATIENT']));
    expect(full.statusCode).toBe(409);
    expect(String(full.body['detail'])).toContain('completo');
  });

  it('fecha fuera del bitmask del horario rechazada', async () => {
    // Buscar un domingo (no configurado)
    const base = new Date(`${availabilityDate}T00:00:00Z`);
    base.setUTCDate(base.getUTCDate() + ((7 - base.getUTCDay()) % 7));
    const sunday = base.toISOString().slice(0, 10);

    const result = await book(tokenFor(patientC.userId, ['PATIENT']), mainScheduleId);
    void result;
    const wrongDay = await app.inject({
      method: 'POST',
      url: '/api/v1/appointments',
      headers: tokenFor(patientC.userId, ['PATIENT']),
      payload: { scheduleId: mainScheduleId, date: sunday },
    });
    expect(wrongDay.statusCode).toBe(400);
    expect(JSON.parse(wrongDay.body)['detail']).toContain('día');
  });

  it('concurrencia sobre 1 cupo: exactamente uno gana (bloqueo optimista)', async () => {
    // Liberar cupos del horario principal cancelando ambas citas activas
    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/appointments?scheduleId=${mainScheduleId}&date=${availabilityDate}`,
      headers: adminToken(),
    });
    for (const item of JSON.parse(list.body).items as Array<{ id: string; status: string }>) {
      if (item.status !== 'CANCELLED') {
        await setStatus(item.id, 'CANCELLED');
      }
    }

    // Carrera sobre el horario de capacidad 1
    const [r1, r2] = await Promise.all([
      book(tokenFor(patientA.userId, ['PATIENT']), raceScheduleId),
      book(tokenFor(patientB.userId, ['PATIENT']), raceScheduleId),
    ]);

    const codes = [r1.statusCode, r2.statusCode].sort();
    expect(codes).toEqual([201, 409]); // uno gana, el otro conflicto
    const winner = [r1, r2].find((r) => r.statusCode === 201)!;
    expect(winner.body['position']).toBe(1); // único ocupante
  });

  it('reserva requiere rol PATIENT (doctor no reserva)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/appointments',
      headers: tokenFor(doctorUserId, ['DOCTOR']),
      payload: { scheduleId: mainScheduleId, date: availabilityDate },
    });
    expect(response.statusCode).toBe(403);
  });
});

describe('11.5 posición en cola con reutilización tras cancelación', () => {
  it('posición = máx(activo)+1; cancelado libera y el número se reutiliza', async () => {
    // En horario de cola (capacidad 5): A→pos1, B→pos2
    const first = await book(tokenFor(patientA.userId, ['PATIENT']), queueScheduleId);
    const second = await book(tokenFor(patientB.userId, ['PATIENT']), queueScheduleId);
    expect(first.body['position']).toBe(1);
    expect(second.body['position']).toBe(2);

    // Cancelar la primera (dueño)
    const firstId = String(first.body['id']);
    const cancel = await setStatus(firstId, 'CANCELLED', tokenFor(patientA.userId, ['PATIENT']));
    expect(cancel.statusCode).toBe(200);

    // Nueva reserva: posición = máx(activas)+1 → B tiene la 2, C recibe la 3
    const third = await book(tokenFor(patientC.userId, ['PATIENT']), queueScheduleId);
    expect(third.statusCode).toBe(201);
    expect(third.body['position']).toBe(3);
  });
});

describe('11.2 transiciones de estado por rol', () => {
  let pendingId = '';
  let confirmedId = '';
  let ownerD = ''; // usuario dedicado dueño de pendingId
  let ownerE = ''; // usuario dedicado dueño de confirmedId

  beforeAll(async () => {
    // Pacientes dedicados para no chocar con reservas activas de bloques previos
    const d = await registerPatient('cita-d');
    const e = await registerPatient('cita-e');
    ownerD = d.userId;
    ownerE = e.userId;

    const p1 = await book(tokenFor(ownerD, ['PATIENT']), queueScheduleId);
    const p2 = await book(tokenFor(ownerE, ['PATIENT']), queueScheduleId);
    expect(p1.statusCode).toBe(201);
    expect(p2.statusCode).toBe(201);
    pendingId = String(p1.body['id']);
    confirmedId = String(p2.body['id']);
    await setStatus(confirmedId, 'CONFIRMED'); // admin confirma la segunda
  });

  it('paciente no puede confirmar su propia cita (STAFF requerido)', async () => {
    const response = await setStatus(
      pendingId,
      'CONFIRMED',
      tokenFor(ownerD, ['PATIENT'])
    );
    expect(response.statusCode).toBe(409); // transición inválida para su rol
  });

  it('admin confirma PENDING→CONFIRMED; repetir transición CONFLICT', async () => {
    const confirm = await setStatus(pendingId, 'CONFIRMED');
    expect(confirm.statusCode).toBe(200);

    const again = await setStatus(pendingId, 'CONFIRMED');
    expect(again.statusCode).toBe(409);
    expect(String(json(again)['detail'])).toContain('Transición inválida');
  });

  it('doctor del horario completa CONFIRMED→COMPLETED', async () => {
    const completed = await setStatus(
      confirmedId,
      'COMPLETED',
      tokenFor(doctorUserId, ['DOCTOR'])
    );
    // eslint-disable-next-line no-console -- depuración temporal
    console.log('DEBUG1:', completed.statusCode, completed.body.slice(0,300));
    expect(JSON.parse(completed.body).status).toBe('COMPLETED');

    // Terminal: cualquier cambio posterior CONFLICT
    const ghost = await setStatus(confirmedId, 'CANCELLED');
    expect(ghost.statusCode).toBe(409);
  });

  it('doctor marca NO_SHOW sobre cita confirmada', async () => {
    const booked = await book(tokenFor(patientA.userId, ['PATIENT']), queueScheduleId);
    const id = String(booked.body['id']);
    await setStatus(id, 'CONFIRMED');

    const noShow = await setStatus(id, 'NO_SHOW', tokenFor(doctorUserId, ['DOCTOR']));
    expect(noShow.statusCode).toBe(200);
    expect(JSON.parse(noShow.body).status).toBe('NO_SHOW');
  });

  it('paciente cancela su cita pendiente; otra persona ajena recibe FORBIDDEN', async () => {
    // Paciente dedicado: D/E ya tienen citas activas en este horario
    const g = await registerPatient('cita-g');
    const booked = await book(tokenFor(g.userId, ['PATIENT']), queueScheduleId);
    const id = String(booked.body['id']);

    const forbidden = await setStatus(id, 'CANCELLED', tokenFor(ownerE, ['PATIENT']));
    expect(forbidden.statusCode).toBe(403); // ni siquiera puede verla/modificarla

    const ownCancel = await setStatus(id, 'CANCELLED', tokenFor(g.userId, ['PATIENT']));
    expect(ownCancel.statusCode).toBe(200);
  });

  it('cancelar libera cupo: la disponibilidad vuelve a contarla libre', async () => {
    // El horario principal tenía 2/2 ocupadas y ambas fueron canceladas antes
    const availability = await app.inject({
      method: 'GET',
      url: `/api/v1/schedules/availability?doctorId=${doctorRecordId}&specialtyId=${cardiologyId}&date=${availabilityDate}`,
      headers: tokenFor(patientA.userId, ['PATIENT']),
    });
    const slots = JSON.parse(availability.body).items as Array<{
      scheduleId: string;
      available: number;
    }>;
    const main = slots.find((s) => s.scheduleId === mainScheduleId);
    expect(main?.available).toBe(2);
  });
});

describe('11.3 listado con alcance por rol', () => {
  it('paciente ve únicamente sus propias citas', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/appointments',
      headers: tokenFor(patientA.userId, ['PATIENT']),
    });
    const items = JSON.parse(response.body).items as Array<{ patientName: string }>;
    expect(items.length).toBeGreaterThanOrEqual(2);
    for (const item of items) {
      expect(item.patientName).toContain('Pac-cita-a');
    }
  });

  it('doctor ve solo las citas de sus horarios; filtra por fecha', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/appointments?date=${availabilityDate}`,
      headers: tokenFor(doctorUserId, ['DOCTOR']),
    });
    expect(response.statusCode).toBe(200);
    const items = JSON.parse(response.body).items as Array<{ doctorId: string }>;
    expect(items.length).toBeGreaterThanOrEqual(3);
    for (const item of items) {
      expect(item.doctorId).toBe(doctorRecordId);
    }
  });

  it('admin filtra por estado en toda la plataforma', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/appointments?status=CANCELLED&pageSize=100',
      headers: adminToken(),
    });
    const items = JSON.parse(response.body).items as Array<{ status: string }>;
    expect(items.length).toBeGreaterThanOrEqual(3);
    for (const item of items) {
      expect(item.status).toBe('CANCELLED');
    }
  });
});

describe('11.4 observaciones de cita', () => {
  let targetId = '';

  let obsOwner = '';
  beforeAll(async () => {
    const f = await registerPatient('cita-f');
    obsOwner = f.userId;
    const booked = await book(tokenFor(obsOwner, ['PATIENT']), queueScheduleId);
    // eslint-disable-next-line no-console -- depuración temporal
    console.log('DEBUG2:', booked.statusCode, JSON.stringify(booked.body).slice(0,250));
    targetId = String(booked.body['id']);
  });

  it('paciente agrega primera observación', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/appointments/${targetId}/observations`,
      headers: tokenFor(obsOwner, ['PATIENT']),
      payload: { observation: 'Prefiero turno matutino' },
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).observation).toContain('turno matutino');
  });

  it('doctor del horario añade segunda nota concatenada', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/appointments/${targetId}/observations`,
      headers: tokenFor(doctorUserId, ['DOCTOR']),
      payload: { observation: 'Paciente refirió dolor lumbar' },
    });
    const observation = JSON.parse(response.body).observation as string;
    expect(observation).toContain('turno matutino'); // preservada
    expect(observation).toContain('dolor lumbar'); // añadida
  });

  it('paciente ajeno no puede observar (FORBIDDEN)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/appointments/${targetId}/observations`,
      headers: tokenFor(patientC.userId, ['PATIENT']),
      payload: { observation: 'intruso' },
    });
    expect(response.statusCode).toBe(403);
  });
});
