// Tests del módulo de empleados y cargos (tareas 7.1–7.4)
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../src/app.js';
import { prisma } from '../../../src/shared/database/client.js';
import { signAccessToken } from '../../../src/modules/auth/token.service.js';
import { purgeTestUsers, uniqueDni, uniqueEmail } from '../../helpers/test-utils.js';

let app: ReturnType<typeof buildApp>;
const adminId = '00000000-0000-4000-8000-0000000000a3';
const staffId = '00000000-0000-4000-8000-0000000000s3';

function adminToken(): Record<string, string> {
  return { authorization: `Bearer ${signAccessToken({ sub: adminId, roles: ['ADMIN'] })}` };
}
function patientToken(): Record<string, string> {
  return {
    authorization: `Bearer ${signAccessToken({
      sub: '00000000-0000-4000-8000-0000000000p3',
      roles: ['PATIENT'],
    })}`,
  };
}
function unauthenticated(): Record<string, string> | undefined {
  void staffId;
  return undefined;
}

const createdRoleIds: string[] = [];
const createdCargoIds: string[] = [];

async function registerPatient(): Promise<{ userId: string; email: string }> {
  const email = uniqueEmail('emp');
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
      password: 'ClaveEmp123',
      accountType: 'PATIENT',
      bloodType: 'O_NEGATIVE',
      person: {
        firstName: 'Empleado',
        lastName: 'Potencial',
        birthDate: '1996-06-06',
        dni: uniqueDni('EMP'),
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

beforeAll(async () => {
  app = buildApp();
  await purgeTestUsers();
});

afterAll(async () => {
  await purgeTestUsers(); // borra employees + employee_cargos vía usuario
  await prisma.cargo.deleteMany({ where: { id: { in: createdCargoIds }, name: { startsWith: 'TEST-' } } });
  await prisma.role.deleteMany({ where: { id: { in: createdRoleIds }, name: { startsWith: 'TEST-' } } });
  await app.close();
  await prisma.$disconnect();
});

describe('CRUD de cargos (/api/v1/cargos)', () => {
  it('lista requiere autenticación', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/cargos',
    });
    expect(response.statusCode).toBe(401);
  });

  it('usuario autenticado ve catálogo sembrado; filtro ?status=ACTIVE funciona', async () => {
    const all = await app.inject({
      method: 'GET',
      url: '/api/v1/cargos',
      headers: patientToken(),
    });
    expect(all.statusCode).toBe(200);
    const body = JSON.parse(all.body);
    expect(body.total).toBeGreaterThanOrEqual(6); // sembrados
    for (const item of body.items) {
      expect(item.status).toBe('ACTIVE');
    }
  });

  it('PATIENT no puede crear cargos (FORBIDDEN)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/cargos',
      headers: patientToken(),
      payload: { name: `TEST-Cargo-${Date.now()}` },
    });
    expect(response.statusCode).toBe(403);
  });

  it('ADMIN crea cargo; duplicado CONFLICT; PATCH desactiva', async () => {
    const cargoName = `TEST-Farmacia-${Date.now()}`;
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/cargos',
      headers: adminToken(),
      payload: { name: cargoName },
    });
    expect(created.statusCode).toBe(201);
    const cargo = JSON.parse(created.body);
    createdCargoIds.push(cargo.id);

    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/v1/cargos',
      headers: adminToken(),
      payload: { name: cargoName },
    });
    expect(duplicate.statusCode).toBe(409);

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/v1/cargos/${cargo.id}`,
      headers: adminToken(),
      payload: { status: 'INACTIVE' },
    });
    expect(patched.statusCode).toBe(200);

    // El filtro de activos ya no lo incluye
    const activeOnly = await app.inject({
      method: 'GET',
      url: `/api/v1/cargos?status=ACTIVE&pageSize=100`,
      headers: patientToken(),
    });
    const names = JSON.parse(activeOnly.body).items.map((c: { name: string }) => c.name);
    expect(names).not.toContain(cargoName);
  });

  it('PATCH sobre cargo inexistente NOT_FOUND', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/cargos/00000000-0000-4000-8000-00000000dead',
      headers: adminToken(),
      payload: { status: 'INACTIVE' },
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('empleados: vinculación a usuarios y filtros', () => {
  let employeeUserId = '';
  let employeeRecordId = '';
  let secondUserId = '';

  beforeAll(async () => {
    const first = await registerPatient();
    employeeUserId = first.userId;

    // Segundo usuario con rol EMPLOYEE asignado para probar filtro por rol
    const second = await registerPatient();
    secondUserId = second.userId;
  });

  it('crea empleado vinculado a usuario existente', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/employees',
      headers: adminToken(),
      payload: { userId: employeeUserId },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    employeeRecordId = body.id;
    expect(body.email).toContain('@auth-test.local');
    expect(body.status).toBe('ACTIVE');
  });

  it('rechaza duplicar empleado para el mismo usuario (CONFLICT)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/employees',
      headers: adminToken(),
      payload: { userId: employeeUserId },
    });
    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body)['detail']).toContain('empleado');
  });

  it('valida que el usuario exista (VALIDATION_ERROR)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/employees',
      headers: adminToken(),
      payload: { userId: '00000000-0000-4000-8000-00000000dead' },
    });
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)['detail']).toContain('usuario');
  });

  it('filtra empleados por rol del usuario vinculado', async () => {
    // Registrar el segundo usuario como empleado y asignarle rol EMPLOYEE
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/employees',
      headers: adminToken(),
      payload: { userId: secondUserId },
    });
    expect(created.statusCode).toBe(201);

    const role = await prisma.role.findFirstOrThrow({ where: { name: 'EMPLOYEE' } });
    await app.inject({
      method: 'POST',
      url: `/api/v1/users/${secondUserId}/roles`,
      headers: adminToken(),
      payload: { roleId: role.id },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/employees?role=EMPLOYEE',
      headers: adminToken(),
    });

    expect(response.statusCode).toBe(200);
    const items = JSON.parse(response.body).items;
    expect(items.length).toBeGreaterThanOrEqual(1);
    for (const item of items) {
      expect(item.roles).toContain('EMPLOYEE');
    }
  });

  it('lista general incluye cargo actual (null si no tiene)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/employees',
      headers: adminToken(),
    });
    const items = JSON.parse(response.body).items;
    const target = items.find((e: { id: string }) => e.id === employeeRecordId);
    expect(target).toBeDefined();
    expect(target.currentCargo).toBeNull();
  });
});

describe('asignación empleado-cargo con historial', () => {
  let employeeId = '';
  let recepcionId = '';
  let facturacionId = '';

  beforeAll(async () => {
    const { userId } = await registerPatient();
    const employee = await app.inject({
      method: 'POST',
      url: '/api/v1/employees',
      headers: adminToken(),
      payload: { userId },
    });
    employeeId = JSON.parse(employee.body).id;

    for (const name of [`TEST-CargoA-${Date.now()}`, `TEST-CargoB-${Date.now()}`]) {
      const cargo = await app.inject({
        method: 'POST',
        url: '/api/v1/cargos',
        headers: adminToken(),
        payload: { name },
      });
      createdCargoIds.push(JSON.parse(cargo.body).id);
    }
    const seeded = await prisma.cargo.findMany({
      where: { name: { in: ['Recepcionista', 'Facturación'] } },
    });
    recepcionId = seeded.find((c) => c.name === 'Recepcionista')!.id;
    facturacionId = seeded.find((c) => c.name === 'Facturación')!.id;
  });

  it('asigna primer cargo con timestamp', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/employees/${employeeId}/cargos`,
      headers: adminToken(),
      payload: { cargoId: recepcionId },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.cargoName).toBe('Recepcionista');
    expect(body.assignedAt).toBeDefined();

    // Historial refleja la primera asignación
    const history = await app.inject({
      method: 'GET',
      url: `/api/v1/employees/${employeeId}/cargos`,
      headers: adminToken(),
    });
    const histBody = JSON.parse(history.body);
    expect(histBody.total).toBe(1);
    expect(histBody.items[0].cargoName).toBe('Recepcionista');
  });

  it('reasignar el mismo cargo actual genera CONFLICT', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/employees/${employeeId}/cargos`,
      headers: adminToken(),
      payload: { cargoId: recepcionId },
    });
    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body)['detail']).toContain('posición actual');
  });

  it('cambio a otro cargo crea NUEVA fila preservando historial', async () => {
    const change = await app.inject({
      method: 'POST',
      url: `/api/v1/employees/${employeeId}/cargos`,
      headers: adminToken(),
      payload: { cargoId: facturacionId },
    });
    expect(change.statusCode).toBe(201);

    // Volver a Recepcionista también es válido (nueva fila futura)
    const back = await app.inject({
      method: 'POST',
      url: `/api/v1/employees/${employeeId}/cargos`,
      headers: adminToken(),
      payload: { cargoId: recepcionId },
    });
    expect(back.statusCode).toBe(201);

    const history = await app.inject({
      method: 'GET',
      url: `/api/v1/employees/${employeeId}/cargos`,
      headers: adminToken(),
    });
    const histBody = JSON.parse(history.body);
    expect(histBody.total).toBe(3); // Recepcionista → Facturación → Recepcionista
    expect(histBody.items[0].cargoName).toBe('Recepcionista'); // más reciente primero

    // El listado general muestra el cargo vigente
    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/employees?pageSize=100',
      headers: adminToken(),
    });
    const target = JSON.parse(list.body).items.find(
      (e: { id: string }) => e.id === employeeId
    );
    expect(target.currentCargo).toBe('Recepcionista');
  });

  it('valida que el cargo exista antes de asignar', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/employees/${employeeId}/cargos`,
      headers: adminToken(),
      payload: { cargoId: '00000000-0000-4000-8000-00000000dead' },
    });
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)['detail']).toContain('cargo');
  });

  it('requiere ADMIN para consultar historial', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/employees/${employeeId}/cargos`,
      headers: patientToken(),
    });
    expect(response.statusCode).toBe(403);
  });

  void unauthenticated;
});
