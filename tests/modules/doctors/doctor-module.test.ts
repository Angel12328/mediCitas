// Tests del módulo de doctores: especialidades, perfiles, horarios y disponibilidad
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../src/app.js';
import { prisma } from '../../../src/shared/database/client.js';
import { signAccessToken } from '../../../src/modules/auth/token.service.js';
import { purgeTestUsers, uniqueDni, uniqueEmail } from '../../helpers/test-utils.js';

let app: ReturnType<typeof buildApp>;
const adminId = '00000000-0000-4000-8000-0000000000a4';

function adminToken(): Record<string, string> {
  return { authorization: `Bearer ${signAccessToken({ sub: adminId, roles: ['ADMIN'] })}` };
}
function patientToken(sub = '00000000-0000-4000-8000-0000000000p4'): Record<string, string> {
  return { authorization: `Bearer ${signAccessToken({ sub, roles: ['PATIENT'] })}` };
}

const createdSpecialtyIds: string[] = [];
const createdAppointmentIds: string[] = [];
let patientId = ''; // id del registro Patient
let patientUserId = '';
let employeeRecordId = '';
let doctorRecordId = '';
let cardiologyId = ''; // Cardiología sembrada
let dermatologyId = '';

/** Fecha ISO YYYY-MM-DD del próximo lunes (UTC) */
function nextMondayIso(): string {
  const now = new Date();
  const jsDay = now.getUTCDay();
  const diff = ((8 - jsDay) % 7 || 7) + 7; // lunes de la semana siguiente
  const target = new Date(now.getTime() + diff * 86400000);
  return target.toISOString().slice(0, 10);
}

async function registerPatientUser(): Promise<{ userId: string; patientDbId: string }> {
  const email = uniqueEmail('doc');
  const country = await prisma.country.findFirstOrThrow({ where: { name: 'Honduras' } });
  const department = await prisma.department.findFirstOrThrow({ where: { name: 'Cortés' } });
  const municipality = await prisma.municipality.findFirstOrThrow({
    where: { name: 'San Pedro Sula', departmentId: department.id },
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      email,
      password: 'ClaveDoc123',
      accountType: 'PATIENT',
      bloodType: 'A_POSITIVE',
      person: {
        firstName: 'Doctorando',
        lastName: 'De Prueba',
        birthDate: '1985-05-05',
        dni: uniqueDni('DOC'),
        gender: 'M',
        countryId: country.id,
        departmentId: department.id,
        municipalityId: municipality.id,
      },
    },
  });
  expect(response.statusCode).toBe(201);
  const body = JSON.parse(response.body);

  const patientRow = await prisma.patient.findUniqueOrThrow({
    where: { userId: body.user.id },
  });
  return { userId: body.user.id, patientDbId: patientRow.id };
}

beforeAll(async () => {
  app = buildApp();
  await purgeTestUsers();

  // Fixture: paciente → empleado → doctor
  const registered = await registerPatientUser();
  patientUserId = registered.userId;
  patientId = registered.patientDbId;

  const employee = await app.inject({
    method: 'POST',
    url: '/api/v1/employees',
    headers: adminToken(),
    payload: { userId: patientUserId },
  });
  employeeRecordId = JSON.parse(employee.body).id;

  const cardiology = await prisma.specialty.findFirstOrThrow({ where: { name: 'Cardiología' } });
  cardiologyId = cardiology.id;
  const dermatology = await prisma.specialty.findFirstOrThrow({ where: { name: 'Dermatología' } });
  dermatologyId = dermatology.id;
});

afterAll(async () => {
  await prisma.appointment.deleteMany({ where: { id: { in: createdAppointmentIds } } });
  await purgeTestUsers(); // borra doctors/schedules vía empleado
  await prisma.specialty.deleteMany({
    where: { id: { in: createdSpecialtyIds }, name: { startsWith: 'TEST-' } },
  });
  await app.close();
  await prisma.$disconnect();
});

describe('CRUD especialidades (/api/v1/specialties)', () => {
  it('lista requiere autenticación', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/specialties' });
    expect(response.statusCode).toBe(401);
  });

  it('usuario autenticado ve catálogo sembrado', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/specialties',
      headers: patientToken(),
    });
    const names = JSON.parse(response.body).items.map((s: { name: string }) => s.name);
    expect(names).toContain('Cardiología');
  });

  it('PATIENT no crea; ADMIN crea y duplicado CONFLICT', async () => {
    const denied = await app.inject({
      method: 'POST',
      url: '/api/v1/specialties',
      headers: patientToken(),
      payload: { name: `TEST-Genetica-${Date.now()}` },
    });
    expect(denied.statusCode).toBe(403);

    const specialtyName = `TEST-Genetica-${Date.now()}`;
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/specialties',
      headers: adminToken(),
      payload: { name: specialtyName },
    });
    expect(created.statusCode).toBe(201);
    createdSpecialtyIds.push(JSON.parse(created.body).id);

    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/v1/specialties',
      headers: adminToken(),
      payload: { name: specialtyName },
    });
    expect(duplicate.statusCode).toBe(409);
  });

  it('desactivar la excluye de ?status=ACTIVE sin borrar asignaciones', async () => {
    // Asignar Cardiología al doctor para verificar preservación tras desactivarla
    const assign = await app.inject({
      method: 'POST',
      url: `/api/v1/doctors`,
      headers: adminToken(),
      payload: { employeeId: employeeRecordId },
    });
    expect(assign.statusCode).toBe(201);
    doctorRecordId = JSON.parse(assign.body).id;

    await app.inject({
      method: 'POST',
      url: `/api/v1/doctors/${doctorRecordId}/specialties`,
      headers: adminToken(),
      payload: { specialtyId: cardiologyId },
    });

    // Desactivar especialidad
    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/v1/specialties/${cardiologyId}`,
      headers: adminToken(),
      payload: { status: 'INACTIVE' },
    });
    expect(patched.statusCode).toBe(200);

    const activeOnly = await app.inject({
      method: 'GET',
      url: '/api/v1/specialties?status=ACTIVE',
      headers: patientToken(),
    });
    const names = JSON.parse(activeOnly.body).items.map((s: { name: string }) => s.name);
    expect(names).not.toContain('Cardiología');

    // Asignación preservada en BD
    const assignment = await prisma.doctorSpecialty.findUniqueOrThrow({
      where: { doctorId_specialtyId: { doctorId: doctorRecordId, specialtyId: cardiologyId } },
    });
    expect(assignment.status).toBe('ACTIVE');

    // Reactivar
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/specialties/${cardiologyId}`,
      headers: adminToken(),
      payload: { status: 'ACTIVE' },
    });
  });
});

describe('doctores: vinculación a empleado y filtros', () => {
  it('rechaza empleado inexistente con VALIDATION_ERROR', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/doctors',
      headers: adminToken(),
      payload: { employeeId: '00000000-0000-4000-8000-00000000dead' },
    });
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)['detail']).toContain('empleado');
  });

  it('creado en fixture; duplicar genera CONFLICT', async () => {
    expect(doctorRecordId).toBeTruthy();
    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/v1/doctors',
      headers: adminToken(),
      payload: { employeeId: employeeRecordId },
    });
    expect(duplicate.statusCode).toBe(409);
  });

  it('filtra por estado ACTIVE y por especialidad', async () => {
    const activeList = await app.inject({
      method: 'GET',
      url: '/api/v1/doctors?status=ACTIVE',
    });
    const idsActive = JSON.parse(activeList.body).items.map((d: { id: string }) => d.id);
    expect(idsActive).toContain(doctorRecordId);

    const bySpecialty = await app.inject({
      method: 'GET',
      url: `/api/v1/doctors?specialtyId=${cardiologyId}`,
    });
    const idsBySpec = JSON.parse(bySpecialty.body).items.map((d: { id: string }) => d.id);
    expect(idsBySpec).toContain(doctorRecordId);

    const byOther = await app.inject({
      method: 'GET',
      url: `/api/v1/doctors?specialtyId=${dermatologyId}`,
    });
    expect(JSON.parse(byOther.body).items.map((d: { id: string }) => d.id)).not.toContain(
      doctorRecordId
    );
  });

  it('detalle público incluye especialidades', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/doctors/${doctorRecordId}`,
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.specialties.map((s: { name: string }) => s.name)).toContain('Cardiología');
  });

  it('PATCH desactiva doctor y sale del filtro ACTIVE', async () => {
    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/v1/doctors/${doctorRecordId}`,
      headers: adminToken(),
      payload: { status: 'INACTIVE' },
    });
    expect(patched.statusCode).toBe(200);

    const list = await app.inject({ method: 'GET', url: '/api/v1/doctors?status=ACTIVE' });
    expect(JSON.parse(list.body).items.map((d: { id: string }) => d.id)).not.toContain(
      doctorRecordId
    );

    // Reactivar para las pruebas de horarios
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/doctors/${doctorRecordId}`,
      headers: adminToken(),
      payload: { status: 'ACTIVE' },
    });
  });
});

describe('asignación doctor-especialidad', () => {
  it('asigna Dermatología; duplicada CONFLICT; DELETE retira; reasignar reactiva', async () => {
    const assigned = await app.inject({
      method: 'POST',
      url: `/api/v1/doctors/${doctorRecordId}/specialties`,
      headers: adminToken(),
      payload: { specialtyId: dermatologyId },
    });
    expect(assigned.statusCode).toBe(201);

    const duplicate = await app.inject({
      method: 'POST',
      url: `/api/v1/doctors/${doctorRecordId}/specialties`,
      headers: adminToken(),
      payload: { specialtyId: dermatologyId },
    });
    expect(duplicate.statusCode).toBe(409);

    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/v1/doctors/${doctorRecordId}/specialties/${dermatologyId}`,
      headers: adminToken(),
    });
    expect(removed.statusCode).toBe(204);

    // Ya no aparece en detalle
    const detail = await app.inject({ method: 'GET', url: `/api/v1/doctors/${doctorRecordId}` });
    expect(
      JSON.parse(detail.body).specialties.map((s: { name: string }) => s.name)
    ).not.toContain('Dermatología');

    // Reasignación reactiva (200)
    const reassigned = await app.inject({
      method: 'POST',
      url: `/api/v1/doctors/${doctorRecordId}/specialties`,
      headers: adminToken(),
      payload: { specialtyId: dermatologyId },
    });
    expect(reassigned.statusCode).toBe(200);

    // Segundo DELETE → NOT_FOUND (ya inactiva)
    await app.inject({
      method: 'DELETE',
      url: `/api/v1/doctors/${doctorRecordId}/specialties/${dermatologyId}`,
      headers: adminToken(),
    });
    const secondDelete = await app.inject({
      method: 'DELETE',
      url: `/api/v1/doctors/${doctorRecordId}/specialties/${dermatologyId}`,
      headers: adminToken(),
    });
    expect(secondDelete.statusCode).toBe(404);
  });

  it('valida que la especialidad exista', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/doctors/${doctorRecordId}/specialties`,
      headers: adminToken(),
      payload: { specialtyId: '00000000-0000-4000-8000-00000000dead' },
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('horarios con bitmask y validaciones', () => {
  const LUNES = 1 << 0;
  const MIERCOLES = 1 << 2;

  it('valida formato de horas, capacidad y máscara', async () => {
    const base = {
      doctorId: doctorRecordId,
      specialtyId: cardiologyId,
      daysBitmask: LUNES,
      startTime: '08:00',
      endTime: '12:00',
      slotCapacity: 2,
    };

    const badTime = await app.inject({
      method: 'POST',
      url: '/api/v1/schedules',
      headers: adminToken(),
      payload: { ...base, startTime: '8am' },
    });
    expect(badTime.statusCode).toBe(400);

    const inverted = await app.inject({
      method: 'POST',
      url: '/api/v1/schedules',
      headers: adminToken(),
      payload: { ...base, endTime: '07:00' },
    });
    expect(inverted.statusCode).toBe(400);

    const zeroCapacity = await app.inject({
      method: 'POST',
      url: '/api/v1/schedules',
      headers: adminToken(),
      payload: { ...base, slotCapacity: 0 },
    });
    expect(zeroCapacity.statusCode).toBe(400);

    const emptyMask = await app.inject({
      method: 'POST',
      url: '/api/v1/schedules',
      headers: adminToken(),
      payload: { ...base, daysBitmask: 0 },
    });
    expect(emptyMask.statusCode).toBe(400);
  });

  it('exige que el doctor tenga la especialidad asignada', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/schedules',
      headers: adminToken(),
      payload: {
        doctorId: doctorRecordId,
        specialtyId: dermatologyId, // fue retirada en el bloque anterior
        daysBitmask: LUNES,
        startTime: '14:00',
        endTime: '18:00',
        slotCapacity: 3,
      },
    });
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)['detail']).toContain('especialidad');
  });

  it('crea horario Lunes+Miércoles; solapamiento CONFLICT; horario distinto OK', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/schedules',
      headers: adminToken(),
      payload: {
        doctorId: doctorRecordId,
        specialtyId: cardiologyId,
        daysBitmask: LUNES | MIERCOLES,
        startTime: '08:00',
        endTime: '12:00',
        slotCapacity: 2,
        observation: 'Turno matutino',
      },
    });
    expect(created.statusCode).toBe(201);
    expect(JSON.parse(created.body).daysBitmask).toBe(LUNES | MIERCOLES);

    // Solapamiento: mismos días, rango cruzado
    const overlapping = await app.inject({
      method: 'POST',
      url: '/api/v1/schedules',
      headers: adminToken(),
      payload: {
        doctorId: doctorRecordId,
        specialtyId: cardiologyId,
        daysBitmask: LUNES | MIERCOLES,
        startTime: '10:00',
        endTime: '14:00',
        slotCapacity: 1,
      },
    });
    expect(overlapping.statusCode).toBe(409);

    // Sin conflicto: mismo días pero turno vespertino contiguo
    const evening = await app.inject({
      method: 'POST',
      url: '/api/v1/schedules',
      headers: adminToken(),
      payload: {
        doctorId: doctorRecordId,
        specialtyId: cardiologyId,
        daysBitmask: LUNES | MIERCOLES,
        startTime: '12:00',
        endTime: '16:00',
        slotCapacity: 1,
      },
    });
    expect(evening.statusCode).toBe(201);
  });

  it('PATCH actualiza horas; DELETE elimina (soft)', async () => {
    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/schedules?doctorId=${doctorRecordId}&status=ACTIVE`,
      headers: patientToken(),
    });
    const schedules = JSON.parse(list.body).items as Array<{
      id: string;
      startTime: string;
      endTime: string;
    }>;
    expect(schedules.length).toBeGreaterThanOrEqual(2);

    const morning = schedules.find((s) => s.startTime === '08:00')!;
    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/v1/schedules/${morning.id}`,
      headers: adminToken(),
      payload: { endTime: '11:30' },
    });
    expect(patched.statusCode).toBe(200);
    expect(JSON.parse(patched.body).endTime).toBe('11:30');

    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/v1/schedules/${morning.id}`,
      headers: adminToken(),
    });
    expect(removed.statusCode).toBe(204);

    const afterDelete = await app.inject({
      method: 'GET',
      url: `/api/v1/schedules?doctorId=${doctorRecordId}`,
      headers: patientToken(),
    });
    expect(
      JSON.parse(afterDelete.body).items.some((s: { id: string }) => s.id === morning.id)
    ).toBe(false);
  });
});

describe('GET /schedules/availability', () => {
  const LUNES = 1 << 0;
  let scheduleId = '';
  let availabilityDate = '';

  beforeAll(async () => {
    // Recrear asignación de Cardiología si fue retirada
    await app.inject({
      method: 'POST',
      url: `/api/v1/doctors/${doctorRecordId}/specialties`,
      headers: adminToken(),
      payload: { specialtyId: cardiologyId },
    });
    availabilityDate = nextMondayIso();

    // Limpiar horarios previos para evitar solapamientos con el fixture
    const existing = await app.inject({
      method: 'GET',
      url: `/api/v1/schedules?doctorId=${doctorRecordId}&pageSize=100`,
      headers: adminToken(),
    });
    for (const s of JSON.parse(existing.body).items as Array<{ id: string }>) {
      await app.inject({
        method: 'DELETE',
        url: `/api/v1/schedules/${s.id}`,
        headers: adminToken(),
      });
    }

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/schedules',
      headers: adminToken(),
      payload: {
        doctorId: doctorRecordId,
        specialtyId: cardiologyId,
        daysBitmask: LUNES,
        startTime: '09:00',
        endTime: '13:00',
        slotCapacity: 2,
      },
    });
    expect(created.statusCode).toBe(201);
    scheduleId = JSON.parse(created.body).id;
    expect(scheduleId).toBeTruthy();
  });

  it('devuelve cupo disponible completo cuando no hay citas', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/schedules/availability?doctorId=${doctorRecordId}&specialtyId=${cardiologyId}&date=${availabilityDate}`,
      headers: patientToken(patientUserId),
    });

    expect(response.statusCode).toBe(200);
    const items = JSON.parse(response.body).items;
    const slot = items.find((s: { scheduleId: string }) => s.scheduleId === scheduleId);
    expect(slot).toBeDefined();
    expect(slot.available).toBe(2);
  });

  it('reduce cupos al agendar y excluye el horario cuando se completa', async () => {
    // Simular dos reservas directas en BD (el endpoint de reserva es tarea 11.1)
    for (let i = 0; i < 2; i++) {
      const appointment = await prisma.appointment.create({
        data: {
          patientId,
          scheduleId,
          date: new Date(`${availabilityDate}T00:00:00Z`),
          status: 'CONFIRMED',
          position: i + 1,
        },
      });
      createdAppointmentIds.push(appointment.id);
    }

    const fullDay = await app.inject({
      method: 'GET',
      url: `/api/v1/schedules/availability?doctorId=${doctorRecordId}&specialtyId=${cardiologyId}&date=${availabilityDate}`,
      headers: patientToken(patientUserId),
    });
    expect(
      JSON.parse(fullDay.body).items.some((s: { scheduleId: string }) => s.scheduleId === scheduleId)
    ).toBe(false); // excluido por completo
  });

  it('una cita CANCELADA libera cupo nuevamente', async () => {
    const first = createdAppointmentIds[0];
    if (!first) throw new Error('fixture incompleto');
    await prisma.appointment.update({
      where: { id: first },
      data: { status: 'CANCELLED' },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/schedules/availability?doctorId=${doctorRecordId}&specialtyId=${cardiologyId}&date=${availabilityDate}`,
      headers: patientToken(patientUserId),
    });
    const slot = JSON.parse(response.body).items.find(
      (s: { scheduleId: string }) => s.scheduleId === scheduleId
    );
    expect(slot).toBeDefined();
    expect(slot.booked).toBe(1);
    expect(slot.available).toBe(1);
  });

  it('fecha sin horarios devuelve lista vacía informativa', async () => {
    // Buscar un domingo (bit 6 no configurado)
    const sunday = new Date(`${availabilityDate}T00:00:00Z`);
    sunday.setUTCDate(sunday.getUTCDate() + ((7 - sunday.getUTCDay()) % 7));
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/schedules/availability?doctorId=${doctorRecordId}&specialtyId=${cardiologyId}&date=${sunday.toISOString().slice(0, 10)}`,
      headers: patientToken(patientUserId),
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).items).toHaveLength(0);
  });
});
