// Tests de alta manual y activación/desactivación de usuarios (tareas 7.2–7.3)
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../src/app.js';
import { signAccessToken } from '../../../src/modules/auth/token.service.js';
import { getSeedLocation, purgeTestUsers, uniqueDni, uniqueEmail } from '../../helpers/test-utils.js';

let app: ReturnType<typeof buildApp>;
const adminId = '00000000-0000-4000-8000-0000000000a3';

function adminToken(): Record<string, string> {
  return { authorization: `Bearer ${signAccessToken({ sub: adminId, roles: ['ADMIN'] })}` };
}
function patientToken(sub: string): Record<string, string> {
  return { authorization: `Bearer ${signAccessToken({ sub, roles: ['PATIENT'] })}` };
}

const creados: Array<{ email: string; password: string; id?: string }> = [];

async function crear(payloadOverrides?: Record<string, unknown>) {
  const loc = await getSeedLocation();
  const email = uniqueEmail('admin-created');
  const payload = {
    email,
    password: 'ClaveAdmin123',
    accountType: 'PATIENT',
    bloodType: 'A_POSITIVE',
    roleNames: ['PATIENT'],
    person: {
      firstName: 'Creado',
      lastName: 'Por Admin',
      birthDate: '1992-02-02',
      dni: uniqueDni('ADM'),
      gender: 'M',
      countryId: loc.countryId,
      departmentId: loc.departmentId,
      municipalityId: loc.municipalityId,
    },
    ...payloadOverrides,
  };
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/users',
    headers: adminToken(),
    payload,
  });
  if (res.statusCode === 201) {
    const body = JSON.parse(res.body);
    creados.push({ email: payload.email as string, password: payload.password as string, id: body.id });
  }
  return res;
}

beforeAll(async () => {
  app = buildApp();
  await purgeTestUsers();
});

afterAll(async () => {
  await purgeTestUsers();
});

describe('POST /users — alta manual por ADMIN', () => {
  it('crea la cuenta con rol PATIENT y permite iniciar sesión', async () => {
    const res = await crear();
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({
      status: 'ACTIVE',
      roles: ['PATIENT'],
      fullName: 'Creado Por Admin',
    });

    // La cuenta es usable de inmediato
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: creados[0].email, password: creados[0].password },
    });
    expect(login.statusCode).toBe(200);
  });

  it('rechaza correo duplicado con CONFLICT y detail específico', async () => {
    const primero = await crear();
    expect(primero.statusCode).toBe(201);
    const emailRepetido = creados[0].email;

    const loc = await getSeedLocation();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: adminToken(),
      payload: {
        email: emailRepetido,
        password: 'ClaveAdmin123',
        accountType: 'EMPLOYEE',
        roleNames: ['EMPLOYEE'],
        person: {
          firstName: 'Otro',
          lastName: 'Usuario',
          birthDate: '1991-01-01',
          dni: uniqueDni('ADM'),
          gender: 'F',
          countryId: loc.countryId,
          departmentId: loc.departmentId,
          municipalityId: loc.municipalityId,
        },
      },
    });
    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.detail ?? body.title).toMatch(/correo ya está registrado/i);
  });

  it('rechaza DNI duplicado con CONFLICT', async () => {
    const primero = await crear();
    expect(primero.statusCode).toBe(201);
    const dni = uniqueDni('DUP');
    const loc = await getSeedLocation();

    // Primera creación con ese DNI
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: adminToken(),
      payload: {
        email: uniqueEmail('dni-a'),
        password: 'ClaveAdmin123',
        accountType: 'EMPLOYEE',
        roleNames: ['EMPLOYEE'],
        person: {
          firstName: 'Dni', lastName: 'Uno', birthDate: '1990-01-01',
          dni, gender: 'M',
          countryId: loc.countryId, departmentId: loc.departmentId, municipalityId: loc.municipalityId,
        },
      },
    });
    expect(res1.statusCode).toBe(201);

    // Segunda con el mismo DNI
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: adminToken(),
      payload: {
        email: uniqueEmail('dni-b'),
        password: 'ClaveAdmin123',
        accountType: 'PATIENT',
        bloodType: 'O_POSITIVE',
        roleNames: ['PATIENT'],
        person: {
          firstName: 'Dni', lastName: 'Dos', birthDate: '1990-01-01',
          dni, gender: 'F',
          countryId: loc.countryId, departmentId: loc.departmentId, municipalityId: loc.municipalityId,
        },
      },
    });
    expect(res2.statusCode).toBe(409);
    expect(JSON.parse(res2.body).detail ?? '').toMatch(/DNI ya está registrado/i);
  });

  it('rechaza un rol inexistente con VALIDATION_ERROR', async () => {
    const res = await crear({ roleNames: ['ROL_INVENTADO'] });
    expect(res.statusCode).toBe(400);
    const problem = JSON.parse(res.body);
    expect(problem.title ?? problem.detail).toBeTruthy();
  });

  it('requiere rol ADMIN (paciente no puede crear cuentas)', async () => {
    const registro = await crear();
    expect(registro.statusCode).toBe(201);
    const userId = JSON.parse(registro.body).id;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: patientToken(userId),
      payload: {},
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('PATCH /users/:id/status — activar/desactivar', () => {
  it('desactiva la cuenta y bloquea su inicio de sesión; reactiva después', async () => {
    const res = await crear();
    const { id } = JSON.parse(res.body);
    const { email, password } = creados.at(-1)!;

    const off = await app.inject({
      method: 'PATCH',
      url: `/api/v1/users/${id}/status`,
      headers: adminToken(),
      payload: { status: 'INACTIVE' },
    });
    expect(off.statusCode).toBe(200);
    expect(JSON.parse(off.body)).toEqual({ id, status: 'INACTIVE' });

    const loginOff = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    expect(loginOff.statusCode).toBe(403);

    const on = await app.inject({
      method: 'PATCH',
      url: `/api/v1/users/${id}/status`,
      headers: adminToken(),
      payload: { status: 'ACTIVE' },
    });
    expect(on.statusCode).toBe(200);
    expect(JSON.parse(on.body)).toEqual({ id, status: 'ACTIVE' });

    const loginOn = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    expect(loginOn.statusCode).toBe(200);
  });

  it('rechaza desactivar la propia cuenta del ADMIN', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/users/${adminId}/status`,
      headers: adminToken(),
      payload: { status: 'INACTIVE' },
    });
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).detail ?? '').toMatch(/propia cuenta/i);
  });

  it('reporta NOT_FOUND para usuario inexistente', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/00000000-0000-4000-8000-ffffffffffff/status',
      headers: adminToken(),
      payload: { status: 'INACTIVE' },
    });
    expect(res.statusCode).toBe(404);
  });
});
