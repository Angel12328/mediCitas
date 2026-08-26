// Tests del módulo de administración de usuarios y roles (tareas 6.1–6.4)
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../src/app.js';
import { signAccessToken } from '../../../src/modules/auth/token.service.js';
import { purgeTestUsers, uniqueEmail } from '../../helpers/test-utils.js';

let app: ReturnType<typeof buildApp>;
const adminId = '00000000-0000-4000-8000-0000000000a2';

function adminToken(): Record<string, string> {
  return { authorization: `Bearer ${signAccessToken({ sub: adminId, roles: ['ADMIN'] })}` };
}
function patientToken(sub = '00000000-0000-4000-8000-0000000000p2'): Record<string, string> {
  return { authorization: `Bearer ${signAccessToken({ sub, roles: ['PATIENT'] })}` };
}

// Usuarios de prueba registrados vía API
const patientA = { email: uniqueEmail('roles-a'), password: 'ClaveRoles123' };
const patientB = { email: uniqueEmail('roles-b'), password: 'ClaveRoles456' };
let patientAId = '';
const createdRoleIds: string[] = [];

async function registerPatient(email: string, password: string): Promise<string> {
  const country = await (
    await import('../../../src/shared/database/client.js')
  ).prisma.country.findFirstOrThrow({ where: { name: 'Honduras' } });
  const department = await (
    await import('../../../src/shared/database/client.js')
  ).prisma.department.findFirstOrThrow({ where: { name: 'Cortés' } });
  const municipality = await (
    await import('../../../src/shared/database/client.js')
  ).prisma.municipality.findFirstOrThrow({
    where: { name: 'San Pedro Sula', departmentId: department.id },
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      email,
      password,
      accountType: 'PATIENT',
      bloodType: 'B_POSITIVE',
      person: {
        firstName: 'Usuario',
        lastName: 'De Roles',
        birthDate: '1994-04-04',
        dni: `RLS-${email.slice(0, 10)}`,
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

beforeAll(async () => {
  app = buildApp();
  await purgeTestUsers(); // residuos previos
  patientAId = await registerPatient(patientA.email, patientA.password);
});

afterAll(async () => {
  // 1) Purgar usuarios primero (borra sus user_roles que referencian roles)
  await purgeTestUsers();
  // 2) Luego eliminar roles de prueba ya sin referencias
  const { prisma } = await import('../../../src/shared/database/client.js');
  await prisma.role.deleteMany({ where: { id: { in: createdRoleIds }, name: { startsWith: 'TEST-' } } });
  await app.close();
  await prisma.$disconnect();
});

describe('GET /api/v1/roles (catálogo solo ADMIN)', () => {
  it('rechaza a PATIENT con FORBIDDEN', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/roles',
      headers: patientToken(),
    });
    expect(response.statusCode).toBe(403);
  });

  it('ADMIN ve los roles sembrados con nombre y estado', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/roles',
      headers: adminToken(),
    });

    expect(response.statusCode).toBe(200);
    const names = JSON.parse(response.body).items.map((r: { name: string }) => r.name);
    expect(names).toEqual(expect.arrayContaining(['ADMIN', 'DOCTOR', 'PATIENT', 'EMPLOYEE']));
  });
});

describe('POST/PATCH /api/v1/roles', () => {
  it('ADMIN crea rol; duplicado CONFLICT', async () => {
    const roleName = `TEST-AUDITOR-${Date.now()}`;
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/roles',
      headers: adminToken(),
      payload: { name: roleName, description: 'Rol de auditoría temporal' },
    });
    expect(created.statusCode).toBe(201);
    const role = JSON.parse(created.body);
    createdRoleIds.push(role.id);

    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/v1/roles',
      headers: adminToken(),
      payload: { name: roleName },
    });
    expect(duplicate.statusCode).toBe(409);
  });

  it('PATCH desactiva rol y se refleja en el catálogo', async () => {
    const roleName = `TEST-VOLATIL-${Date.now()}`;
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/roles',
      headers: adminToken(),
      payload: { name: roleName },
    });
    const role = JSON.parse(created.body);
    createdRoleIds.push(role.id);

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/v1/roles/${role.id}`,
      headers: adminToken(),
      payload: { status: 'INACTIVE' },
    });
    expect(patched.statusCode).toBe(200);
    expect(JSON.parse(patched.body).status).toBe('INACTIVE');
  });

  it('PATCH sobre rol inexistente responde NOT_FOUND', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/roles/00000000-0000-4000-8000-00000000dead',
      headers: adminToken(),
      payload: { status: 'INACTIVE' },
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('asignación usuario-rol (POST/DELETE /users/:id/roles)', () => {
  let auditoriaRoleId = '';

  beforeAll(async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/roles',
      headers: adminToken(),
      payload: { name: `TEST-ASIGNABLE-${Date.now()}` },
    });
    auditoriaRoleId = JSON.parse(created.body).id;
    createdRoleIds.push(auditoriaRoleId);
  });

  it('ADMIN asigna rol a usuario; queda ACTIVE en BD', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/users/${patientAId}/roles`,
      headers: adminToken(),
      payload: { roleId: auditoriaRoleId },
    });

    expect([200, 201]).toContain(response.statusCode);
    expect(JSON.parse(response.body).status).toBe('ACTIVE');

    const assignment = await (
      await import('../../../src/shared/database/client.js')
    ).prisma.userRole.findUniqueOrThrow({
      where: { userId_roleId: { userId: patientAId, roleId: auditoriaRoleId } },
    });
    expect(assignment.status).toBe('ACTIVE');
  });

  it('asignación duplicada activa genera CONFLICT', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/users/${patientAId}/roles`,
      headers: adminToken(),
      payload: { roleId: auditoriaRoleId },
    });
    expect(response.statusCode).toBe(409);
  });

  it('DELETE desactiva la asociación sin borrarla; reasignar reactiva', async () => {
    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/v1/users/${patientAId}/roles/${auditoriaRoleId}`,
      headers: adminToken(),
    });
    expect(removed.statusCode).toBe(204);

    const { prisma } = await import('../../../src/shared/database/client.js');
    const row = await prisma.userRole.findUniqueOrThrow({
      where: { userId_roleId: { userId: patientAId, roleId: auditoriaRoleId } },
    });
    expect(row.status).toBe('INACTIVE'); // historial preservado

    // Segundo DELETE → NOT_FOUND (no está activo)
    const secondDelete = await app.inject({
      method: 'DELETE',
      url: `/api/v1/users/${patientAId}/roles/${auditoriaRoleId}`,
      headers: adminToken(),
    });
    expect(secondDelete.statusCode).toBe(404);

    // Reasignar reactiva
    const reassigned = await app.inject({
      method: 'POST',
      url: `/api/v1/users/${patientAId}/roles`,
      headers: adminToken(),
      payload: { roleId: auditoriaRoleId },
    });
    expect(reassigned.statusCode).toBe(200); // reactivación
  });

  it('valida que el usuario destino exista', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/users/00000000-0000-4000-8000-00000000dead/roles',
      headers: adminToken(),
      payload: { roleId: auditoriaRoleId },
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('GET /api/v1/users (listado ADMIN con filtros)', () => {
  beforeAll(async () => {
    // Registrar un segundo paciente para filtros
    await registerPatient(patientB.email, patientB.password);
  });

  it('pagina y expone metadatos', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/users?page=1&pageSize=2&email=roles-',
      headers: adminToken(),
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.items.length).toBeLessThanOrEqual(2);
    expect(body.total).toBeGreaterThanOrEqual(2);
    expect(body.page).toBe(1);
  });

  it('filtra por fragmento de email', async () => {
    const fragment = patientA.email.split('@')[0].slice(-8); // sufijo único
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/users?email=${fragment}`,
      headers: adminToken(),
    });

    const emails = JSON.parse(response.body).items.map((u: { email: string }) => u.email);
    expect(emails.some((e: string) => e === patientA.email)).toBe(true);
  });

  it('filtra por rol asignado', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/users?role=PATIENT',
      headers: adminToken(),
    });

    const body = JSON.parse(response.body);
    expect(body.total).toBeGreaterThanOrEqual(2);
    for (const item of body.items) {
      expect(item.roles).toContain('PATIENT');
    }
  });

  it('filtra por estado ACTIVE', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/users?status=ACTIVE&pageSize=100',
      headers: adminToken(),
    });
    const items = JSON.parse(response.body).items;
    for (const item of items) {
      expect(item.status).toBe('ACTIVE');
    }
  });
});
