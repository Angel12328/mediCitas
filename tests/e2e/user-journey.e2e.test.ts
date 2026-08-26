// E2E de extremo a extremo: documentación Swagger y journey completo
// de usuario cruzando módulos (tareas 12.1 y 12.2).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { prisma } from '../../src/shared/database/client.js';
import { signAccessToken } from '../../src/modules/auth/token.service.js';
import { purgeTestUsers, uniqueDni, uniqueEmail } from '../helpers/test-utils.js';

let app: ReturnType<typeof buildApp>;
const adminId = '00000000-0000-4000-8000-0000000000e2';
const PASSWORD = 'Journey123';

interface FixtureUser {
  userId: string;
  email: string;
}

function adminToken(): Record<string, string> {
  return { authorization: `Bearer ${signAccessToken({ sub: adminId, roles: ['ADMIN'] })}` };
}
function tokenFor(sub: string, roles: string[]): Record<string, string> {
  return { authorization: `Bearer ${signAccessToken({ sub, roles })}` };
}

async function registerUser(
  prefix: string,
  accountType: 'PATIENT' | 'EMPLOYEE',
  bloodType: 'O_POSITIVE' | 'A_POSITIVE' = 'A_POSITIVE'
): Promise<FixtureUser> {
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
      accountType,
      bloodType,
      person: {
        firstName: `User-${prefix}`,
        lastName: 'Journey',
        birthDate: '1993-03-03',
        dni: uniqueDni('JRNY'),
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

const state = {
  patientUserId: '',
  doctorUserId: '',
  appointmentId: '',
  doctorRecordId: '',
  specialtyId: '',
  scheduleId: '',
  date: '',
};

beforeAll(async () => {
  app = buildApp();
  await purgeTestUsers();
});

afterAll(async () => {
  await purgeTestUsers();
  await app.close();
  await prisma.$disconnect();
});

describe('12.1 documentación OpenAPI/Swagger', () => {
  it('sirve la UI en /docs y el spec JSON en /documentation/json', async () => {
    const ui = await app.inject({ method: 'GET', url: '/docs' });
    expect(ui.statusCode).toBe(200);
    expect(ui.headers['content-type']).toContain('text/html');

    const spec = await app.inject({ method: 'GET', url: '/docs/json' });
    expect(spec.statusCode).toBe(200);

    const openapi = JSON.parse(spec.body) as {
      openapi: string;
      info: { title: string };
      paths: Record<string, unknown>;
    };
    expect(openapi.openapi).toMatch(/^3\./);
    expect(openapi.info.title).toBe('mediCitas API');

    const keyPaths = [
      '/health',
      '/api/v1/auth/login',
      '/api/v1/countries',
      '/api/v1/doctors/',
      '/api/v1/schedules/availability',
      '/api/v1/appointments/',
      '/api/v1/patients/me',
    ];
    for (const path of keyPaths) {
      expect(openapi.paths).toHaveProperty(path);
    }
  });
});

describe('12.2 E2E journey multi-módulo', () => {
  it('despliega personal médico desde registro hasta cita completada', async () => {
    // ── 1. ADMIN crea extensión para recepción
    const extension = await app.inject({
      method: 'POST',
      url: '/api/v1/extensions',
      headers: adminToken(),
      payload: { name: `TEST-Journey-${Date.now()}` },
    });
    expect(extension.statusCode).toBe(201);
    const extensionId = JSON.parse(extension.body).id;

    // ── 2. Recepcionista (EMPLOYEE) con registro laboral
    const receptionist = await registerUser('jrny-rec', 'PATIENT');
    const employee = await app.inject({
      method: 'POST',
      url: '/api/v1/employees',
      headers: adminToken(),
      payload: { userId: receptionist.userId },
    });
    expect(employee.statusCode).toBe(201);

    // ── 3. Doctor: empleado → doctor → especialidad → horario
    const futureDoctor = await registerUser('jrny-doc', 'PATIENT');
    state.doctorUserId = futureDoctor.userId;
    const empForDoc = await app.inject({
      method: 'POST',
      url: '/api/v1/employees',
      headers: adminToken(),
      payload: { userId: futureDoctor.userId },
    });
    const doctor = await app.inject({
      method: 'POST',
      url: '/api/v1/doctors',
      headers: adminToken(),
      payload: { employeeId: JSON.parse(empForDoc.body).id },
    });
    expect(doctor.statusCode).toBe(201);
    state.doctorRecordId = JSON.parse(doctor.body).id;

    state.specialtyId = (
      await prisma.specialty.findFirstOrThrow({ where: { name: 'Pediatría' } })
    ).id;
    await app.inject({
      method: 'POST',
      url: `/api/v1/doctors/${state.doctorRecordId}/specialties`,
      headers: adminToken(),
      payload: { specialtyId: state.specialtyId },
    });

    const now = new Date();
    const jsDay = now.getUTCDay();
    const diff = ((8 - jsDay) % 7 || 7) + 7;
    state.date = new Date(now.getTime() + diff * 86400000).toISOString().slice(0, 10);

    const schedule = await app.inject({
      method: 'POST',
      url: '/api/v1/schedules',
      headers: adminToken(),
      payload: {
        doctorId: state.doctorRecordId,
        specialtyId: state.specialtyId,
        daysBitmask: 1 << 0,
        startTime: '09:00',
        endTime: '13:00',
        slotCapacity: 3,
      },
    });
    expect(schedule.statusCode).toBe(201);
    state.scheduleId = JSON.parse(schedule.body).id;

    // ── 4. Paciente consulta disponibilidad y reserva
    const patient = await registerUser('jrny-pac', 'PATIENT', 'O_POSITIVE');
    state.patientUserId = patient.userId;

    const availability = await app.inject({
      method: 'GET',
      url: `/api/v1/schedules/availability?doctorId=${state.doctorRecordId}&specialtyId=${state.specialtyId}&date=${state.date}`,
      headers: tokenFor(patient.userId, ['PATIENT']),
    });
    expect(JSON.parse(availability.body).items.length).toBeGreaterThanOrEqual(1);

    const booked = await app.inject({
      method: 'POST',
      url: '/api/v1/appointments',
      headers: tokenFor(patient.userId, ['PATIENT']),
      payload: { scheduleId: state.scheduleId, date: state.date },
    });
    expect(booked.statusCode).toBe(201);
    state.appointmentId = JSON.parse(booked.body).id;

    // ── 5. Doctor confirma, observa y completa
    const confirmed = await app.inject({
      method: 'PATCH',
      url: `/api/v1/appointments/${state.appointmentId}/status`,
      headers: tokenFor(state.doctorUserId, ['DOCTOR']),
      payload: { status: 'CONFIRMED' },
    });
    expect(confirmed.statusCode).toBe(200);

    await app.inject({
      method: 'POST',
      url: `/api/v1/appointments/${state.appointmentId}/observations`,
      headers: tokenFor(state.doctorUserId, ['DOCTOR']),
      payload: { observation: 'Control anual; paciente estable' },
    });

    const completed = await app.inject({
      method: 'PATCH',
      url: `/api/v1/appointments/${state.appointmentId}/status`,
      headers: tokenFor(state.doctorUserId, ['DOCTOR']),
      payload: { status: 'COMPLETED' },
    });
    expect(completed.statusCode).toBe(200);

    // ── 6. Paciente agrega su teléfono y consulta perfil
    const ownPerson = await prisma.user.findUniqueOrThrow({
      where: { id: patient.userId },
      select: { personId: true },
    });
    const phone = await app.inject({
      method: 'POST',
      url: '/api/v1/phones',
      headers: tokenFor(patient.userId, ['PATIENT']),
      payload: {
        number: '9876-5432',
        personId: ownPerson.personId,
        extensionId,
      },
    });
    expect(phone.statusCode).toBe(201);

    const profile = await app.inject({
      method: 'GET',
      url: '/api/v1/patients/me',
      headers: tokenFor(patient.userId, ['PATIENT']),
    });
    expect(profile.statusCode).toBe(200);
    expect(JSON.parse(profile.body).bloodType).toBe('O_POSITIVE');
  });

  it('el estado final es consistente entre módulos', async () => {
    // Admin lista pacientes por rol → incluye al del journey
    const users = await app.inject({
      method: 'GET',
      url: '/api/v1/users?role=PATIENT&pageSize=100',
      headers: adminToken(),
    });
    const emails = JSON.parse(users.body).items.map((u: { email: string }) => u.email);
    expect(emails.some((e) => e.startsWith('jrny-pac-'))).toBe(true);

    // El doctor ve SU cita completada en su agenda
    const agenda = await app.inject({
      method: 'GET',
      url: `/api/v1/appointments?status=COMPLETED&date=${state.date}`,
      headers: tokenFor(state.doctorUserId, ['DOCTOR']),
    });
    const items = JSON.parse(agenda.body).items as Array<{ id: string; status: string }>;
    expect(items.some((a) => a.id === state.appointmentId && a.status === 'COMPLETED')).toBe(true);
  });
});
