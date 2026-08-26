// Tests del módulo de pacientes: perfil médico y contacto de emergencia
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../src/app.js';
import { prisma } from '../../../src/shared/database/client.js';
import { signAccessToken } from '../../../src/modules/auth/token.service.js';
import { purgeTestUsers, uniqueDni, uniqueEmail } from '../../helpers/test-utils.js';

let app: ReturnType<typeof buildApp>;
const adminId = '00000000-0000-4000-8000-0000000000a5';

function adminToken(): Record<string, string> {
  return { authorization: `Bearer ${signAccessToken({ sub: adminId, roles: ['ADMIN'] })}` };
}

const credentials = { email: '', password: 'ClavePac123' };
let accessToken = '';

async function registerPatient(): Promise<void> {
  credentials.email = uniqueEmail('pac');
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
      ...credentials,
      accountType: 'PATIENT',
      bloodType: 'O_POSITIVE',
      person: {
        firstName: 'Paciente',
        lastName: 'De Perfil',
        birthDate: '1997-07-07',
        dni: uniqueDni('PAC'),
        gender: 'F',
        countryId: country.id,
        departmentId: department.id,
        municipalityId: municipality.id,
      },
    },
  });
  expect(response.statusCode).toBe(201);
}

beforeAll(async () => {
  app = buildApp();
  await purgeTestUsers();
  await registerPatient();

  const login = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: credentials,
  });
  accessToken = JSON.parse(login.body).accessToken;
});

afterAll(async () => {
  await purgeTestUsers();
  await app.close();
  await prisma.$disconnect();
});

describe('GET/PATCH /api/v1/patients/me', () => {
  it('requiere autenticación', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/patients/me' });
    expect(response.statusCode).toBe(401);
  });

  it('ADMIN no tiene perfil de paciente (403 por rol)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/patients/me',
      headers: adminToken(),
    });
    expect(response.statusCode).toBe(403);
  });

  it('devuelve perfil médico completo del paciente autenticado', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/patients/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.email).toBe(credentials.email);
    expect(body.bloodType).toBe('O_POSITIVE');
    expect(body.allergies).toBeNull();
    expect(body.emergencyContact).toBeNull();
  });

  it('PATCH actualiza alergias y tipo de sangre con persistencia', async () => {
    const patched = await app.inject({
      method: 'PATCH',
      url: '/api/v1/patients/me',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        bloodType: 'AB_NEGATIVE',
        allergies: 'Penicilina, polen',
      },
    });
    expect(patched.statusCode).toBe(200);
    expect(JSON.parse(patched.body).bloodType).toBe('AB_NEGATIVE');

    // Persistencia en BD
    const login = await prisma.user.findUniqueOrThrow({
      where: { email: credentials.email },
      include: { patient: true },
    });
    expect(login.patient?.allergies).toBe('Penicilina, polen');

    // Reflejado en GET
    const fetched = await app.inject({
      method: 'GET',
      url: '/api/v1/patients/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const profile = JSON.parse(fetched.body);
    expect(profile.bloodType).toBe('AB_NEGATIVE');
    expect(profile.allergies).toBe('Penicilina, polen');
  });

  it('rechaza tipo de sangre fuera del catálogo estándar (400)', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/patients/me',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { bloodType: 'Z_POSITIVE' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toContain('application/problem+json');
  });
});

describe('contacto de emergencia (/patients/me/emergency-contact)', () => {
  it('inicialmente sin contacto → emergencyContact null', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/patients/me/emergency-contact',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).emergencyContact).toBeNull();
  });

  it('POST crea contacto; segundo POST CONFLICT', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/patients/me/emergency-contact',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { emergencyContactName: 'María Lopez', emergencyContactNumber: '9999-1111' },
    });
    expect(created.statusCode).toBe(201);

    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/v1/patients/me/emergency-contact',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { emergencyContactName: 'Otro Contacto', emergencyContactNumber: '8888-2222' },
    });
    expect(duplicate.statusCode).toBe(409);

    // GET ahora devuelve el contacto
    const fetched = await app.inject({
      method: 'GET',
      url: '/api/v1/patients/me/emergency-contact',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(JSON.parse(fetched.body).emergencyContact).toEqual({
      name: 'María Lopez',
      number: '9999-1111',
    });
  });

  it('PATCH modifica número preservando nombre; persiste en BD', async () => {
    const patched = await app.inject({
      method: 'PATCH',
      url: '/api/v1/patients/me/emergency-contact',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { emergencyContactNumber: '7777-3333' },
    });
    expect(patched.statusCode).toBe(200);
    const body = JSON.parse(patched.body);
    expect(body.name).toBe('María Lopez'); // intacto
    expect(body.number).toBe('7777-3333');

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: credentials.email },
      include: { patient: true },
    });
    expect(user.patient?.emergencyContactNumber).toBe('7777-3333');
  });

  it('valida longitudes mínimas del contacto (400)', async () => {
    const shortNumber = await app.inject({
      method: 'PATCH',
      url: '/api/v1/patients/me/emergency-contact',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { emergencyContactNumber: '123' },
    });
    expect(shortNumber.statusCode).toBe(400);
  });
});
