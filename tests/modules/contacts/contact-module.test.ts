// Tests del módulo de contactos: extensiones y teléfonos (tareas 10.1–10.3)
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../src/app.js';
import { prisma } from '../../../src/shared/database/client.js';
import { signAccessToken } from '../../../src/modules/auth/token.service.js';
import { purgeTestUsers, uniqueDni, uniqueEmail } from '../../helpers/test-utils.js';

let app: ReturnType<typeof buildApp>;
const adminId = '00000000-0000-4000-8000-0000000000a6';

function adminToken(): Record<string, string> {
  return { authorization: `Bearer ${signAccessToken({ sub: adminId, roles: ['ADMIN'] })}` };
}

const credentials = { email: '', password: 'ClaveTel123' };
let accessToken = '';
let ownPersonId = '';
const createdExtensionIds: string[] = [];
let recepcionExtensionId = '';

async function registerPatient(): Promise<void> {
  credentials.email = uniqueEmail('tel');
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
      bloodType: 'A_NEGATIVE',
      person: {
        firstName: 'Contacto',
        lastName: 'De Prueba',
        birthDate: '1998-08-08',
        dni: uniqueDni('TEL'),
        gender: 'O',
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

  const user = await prisma.user.findUniqueOrThrow({
    where: { email: credentials.email },
    include: { person: true },
  });
  ownPersonId = user.person.id;

  const seeded = await prisma.extension.findFirstOrThrow({ where: { name: 'Recepción' } });
  recepcionExtensionId = seeded.id;
});

afterAll(async () => {
  await purgeTestUsers(); // borra phones vía persona
  await prisma.extension.deleteMany({
    where: { id: { in: createdExtensionIds }, name: { startsWith: 'TEST-' } },
  });
  await app.close();
  await prisma.$disconnect();
});

describe('extensiones (/api/v1/extensions)', () => {
  it('lista requiere autenticación', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/extensions' });
    expect(response.statusCode).toBe(401);
  });

  it('autenticado ve catálogo sembrado; filtro ACTIVE funciona', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/extensions?status=ACTIVE',
      headers: adminToken(),
    });
    const names = JSON.parse(response.body).items.map((e: { name: string }) => e.name);
    expect(names).toContain('Recepción');
  });

  it('PATIENT no crea; ADMIN crea y duplicado CONFLICT', async () => {
    const denied = await app.inject({
      method: 'POST',
      url: '/api/v1/extensions',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: `TEST-Laboratorio-${Date.now()}` },
    });
    expect(denied.statusCode).toBe(403);

    const extName = `TEST-RayosX-${Date.now()}`;
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/extensions',
      headers: adminToken(),
      payload: { name: extName },
    });
    expect(created.statusCode).toBe(201);
    createdExtensionIds.push(JSON.parse(created.body).id);

    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/v1/extensions',
      headers: adminToken(),
      payload: { name: extName },
    });
    expect(duplicate.statusCode).toBe(409);
  });

  it('PATCH desactiva extensión', async () => {
    const extName = `TEST-Ventas-${Date.now()}`;
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/extensions',
      headers: adminToken(),
      payload: { name: extName },
    });
    createdExtensionIds.push(JSON.parse(created.body).id);

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/v1/extensions/${JSON.parse(created.body).id}`,
      headers: adminToken(),
      payload: { status: 'INACTIVE' },
    });
    expect(patched.statusCode).toBe(200);
    expect(JSON.parse(patched.body).status).toBe('INACTIVE');
  });
});

describe('teléfonos (/api/v1/phones)', () => {
  let phoneId = '';

  it('agregar teléfono a otra persona está prohibido (FORBIDDEN)', async () => {
    // Crear una segunda persona ajena
    const otherUser = await registerOtherPatient();
    const otherPerson = await prisma.user.findUniqueOrThrow({
      where: { id: otherUser },
      include: { person: true },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/phones',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        number: '2222-0000',
        personId: otherPerson.person.id,
        extensionId: recepcionExtensionId,
      },
    });
    expect(response.statusCode).toBe(403);
  });

  it('dueño agrega teléfono a su propia persona', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/phones',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        number: '9999-0001',
        personId: ownPersonId,
        extensionId: recepcionExtensionId,
      },
    });

    expect(response.statusCode).toBe(201);
    phoneId = JSON.parse(response.body).id;
    expect(JSON.parse(response.body).extensionName).toBe('Recepción');
  });

  it('mismo número duplicado para la misma persona CONFLICT', async () => {
    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/v1/phones',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        number: '9999-0001',
        personId: ownPersonId,
        extensionId: recepcionExtensionId,
      },
    });
    expect(duplicate.statusCode).toBe(409);
  });

  it('ADMIN puede agregar teléfono a persona ajena', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/phones',
      headers: adminToken(),
      payload: {
        number: '2222-0000',
        personId: ownPersonId,
        extensionId: recepcionExtensionId,
      },
    });
    expect(response.statusCode).toBe(201);

    // Limpieza inmediata del segundo teléfono
    const secondPhoneId = JSON.parse(response.body).id;
    await app.inject({
      method: 'DELETE',
      url: `/api/v1/phones/${secondPhoneId}`,
      headers: adminToken(),
    });
  });

  it('listado por personId propio muestra teléfonos con extensión', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/phones?personId=${ownPersonId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(response.statusCode).toBe(200);
    const items = JSON.parse(response.body).items;
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0].number).toBe('9999-0001');
  });

  it('PATCH cambia número y extensión', async () => {
    const farmacia = await prisma.extension.findFirstOrThrow({ where: { name: 'Farmacia' } });
    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/v1/phones/${phoneId}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { number: '9999-0002', extensionId: farmacia.id },
    });
    expect(patched.statusCode).toBe(200);
    expect(JSON.parse(patched.body).number).toBe('9999-0002');
    expect(JSON.parse(patched.body).extensionName).toBe('Farmacia');
  });

  it('DELETE soft-deleteda el teléfono; deja de listar', async () => {
    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/v1/phones/${phoneId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(removed.statusCode).toBe(204);

    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/phones?personId=${ownPersonId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(JSON.parse(list.body).items.some((p: { id: string }) => p.id === phoneId)).toBe(false);

    // PATCH sobre eliminado → NOT_FOUND
    const ghostPatch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/phones/${phoneId}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { number: '5555-5555' },
    });
    expect(ghostPatch.statusCode).toBe(404);
  });
});

// Helper local para crear segunda persona ajena
async function registerOtherPatient(): Promise<string> {
  const email = uniqueEmail('tel2');
  const country = await prisma.country.findFirstOrThrow({ where: { name: 'Honduras' } });
  const department = await prisma.department.findFirstOrThrow({
    where: { name: 'Cortés' },
  });
  const municipality = await prisma.municipality.findFirstOrThrow({
    where: { name: 'San Pedro Sula', departmentId: department.id },
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      email,
      password: 'ClaveTel456',
      accountType: 'PATIENT',
      bloodType: 'B_POSITIVE',
      person: {
        firstName: 'Otro',
        lastName: 'Titular',
        birthDate: '1999-09-09',
        dni: uniqueDni('TL2'),
        gender: 'M',
        countryId: country.id,
        departmentId: department.id,
        municipalityId: municipality.id,
      },
    },
  });
  expect(response.statusCode).toBe(201);
  return JSON.parse(response.body).user.id;
}
