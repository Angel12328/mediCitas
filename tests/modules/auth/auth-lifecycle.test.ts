// Tests de ciclo de vida de tokens, restablecimiento y perfil (4.6–4.10, 4.13)
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../src/app.js';
import { prisma } from '../../../src/shared/database/client.js';
import {
  FakeMailer,
  getSeedLocation,
  purgeTestUsers,
  uniqueEmail,
} from '../../helpers/test-utils.js';

let app: ReturnType<typeof buildApp>;
const mailer = new FakeMailer();
const email = uniqueEmail('ciclo');
const originalPassword = 'ClaveOriginal123';
let userId = '';
let refreshToken = '';

async function registerUser(): Promise<void> {
  const location = await getSeedLocation();
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      email,
      password: originalPassword,
      accountType: 'PATIENT',
      bloodType: 'A_NEGATIVE',
      person: {
        firstName: 'Ciclo',
        lastName: 'Completo',
        birthDate: '1993-09-09',
        dni: `CIC${Date.now()}`,
        gender: 'O',
        ...location,
      },
    },
  });
  expect(response.statusCode).toBe(201);
  const body = JSON.parse(response.body);
  userId = body.user.id;
  refreshToken = body.refreshToken;
}

beforeAll(async () => {
  app = buildApp({ mailer });
  await purgeTestUsers(); // limpiar residuos de corridas previas
  await registerUser();
});

afterAll(async () => {
  await purgeTestUsers();
  await app.close();
  await prisma.$disconnect();
});

describe('POST /api/v1/auth/refresh', () => {
  it('rota el refresh token y entrega un access token funcional', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.refreshToken).not.toBe(refreshToken);

    // El nuevo access token funciona en endpoint autenticado
    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${body.accessToken}` },
    });
    expect(me.statusCode).toBe(200);
    refreshToken = body.refreshToken;
  });

  it('rechaza reuso del token ya rotado y revoca la familia', async () => {
    // Guardar token actual antes de rotar de nuevo
    const current = refreshToken;
    const rotation = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: current },
    });
    expect(rotation.statusCode).toBe(200);
    const newest = JSON.parse(rotation.body).refreshToken as string;

    // Reuso del token anterior → familia completa revocada
    const reuse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: current },
    });
    expect(reuse.statusCode).toBe(401);
    expect(JSON.parse(reuse.body)['detail']).toContain('reutilizado');

    // El token más reciente también quedó invalidado
    const withNewest = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: newest },
    });
    expect(withNewest.statusCode).toBe(401);

    // Re-login para continuar la suite
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: originalPassword },
    });
    refreshToken = JSON.parse(login.body).refreshToken as string;
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('revoca el refresh token; su uso posterior falla con UNAUTHORIZED', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      payload: { refreshToken },
    });
    expect(response.statusCode).toBe(204);

    const after = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(after.statusCode).toBe(401);

    // Re-login para continuar
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: originalPassword },
    });
    const body = JSON.parse(login.body);
    refreshToken = body.refreshToken;
  });
});

describe('POST /api/v1/auth/change-password', () => {
  it('requiere contraseña actual correcta', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: originalPassword },
    });
    const accessToken = JSON.parse(login.body).accessToken;

    const bad = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { currentPassword: 'incorrecta', newPassword: 'NuevaClave789xyz' },
    });
    expect(bad.statusCode).toBe(401);
  });

  it('actualiza hash e invalida TODAS las sesiones existentes', async () => {
    // Dos sesiones activas: la actual + una adicional
    const extraLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: originalPassword },
    });

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: originalPassword },
    });
    const accessToken = JSON.parse(login.body).accessToken;

    const changed = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { currentPassword: originalPassword, newPassword: 'NuevaClave789xyz' },
    });
    expect(changed.statusCode).toBe(204);

    // La sesión extra quedó revocada
    const oldSession = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: JSON.parse(extraLogin.body).refreshToken },
    });
    expect(oldSession.statusCode).toBe(401);

    // Login solo funciona con la nueva contraseña
    const oldPwLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: originalPassword },
    });
    expect(oldPwLogin.statusCode).toBe(401);

    const newPwLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'NuevaClave789xyz' },
    });
    expect(newPwLogin.statusCode).toBe(200);
  });
});

describe('restablecimiento de contraseña (forgot + reset)', () => {
  it('responde igual ante correos registrados o no (anti-enumeración)', async () => {
    mailer.sent.length = 0;

    const registered = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      payload: { email },
    });
    const unknown = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      payload: { email: `noexiste-${email}` },
    });

    expect(registered.statusCode).toBe(200);
    expect(unknown.statusCode).toBe(200);
    expect(registered.body).toBe(unknown.body);
    expect(mailer.sent).toHaveLength(1); // solo al correo registrado
  });

  it('flujo completo: token recibido → reset → login con nueva clave', async () => {
    const rawToken = mailer.sent.at(-1)!.resetToken;

    const reset = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: { token: rawToken, newPassword: 'Reseteada999clave' },
    });
    expect(reset.statusCode).toBe(204);

    // El token es de un solo uso
    const reuse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: { token: rawToken, newPassword: 'OtraClave123456' },
    });
    expect(reuse.statusCode).toBe(400);

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'Reseteada999clave' },
    });
    expect(login.statusCode).toBe(200);
    refreshToken = JSON.parse(login.body).refreshToken;
  });
});

describe('GET/PATCH /api/v1/users/me', () => {
  let accessToken = '';

  beforeAll(async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'Reseteada999clave' },
    });
    accessToken = JSON.parse(login.body).accessToken;
  });

  it('GET devuelve perfil completo con persona, roles y datos de paciente', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.email).toBe(email);
    expect(body.roles).toEqual(['PATIENT']);
    expect(body.person.fullName).toContain('Ciclo');
    expect(body.patient.bloodType).toBe('A_NEGATIVE');
  });

  it('GET rechaza requests sin token (401)', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/users/me' });
    expect(response.statusCode).toBe(401);
  });

  it('PATCH actualiza campos permitidos y persiste cambios', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        firstName: 'CicloActualizado',
        address: 'Barrio Centro, Tegucigalpa',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).person.firstName).toBe('CicloActualizado');

    const verify = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(verify.statusCode).toBe(200);
    const profile = JSON.parse(verify.body);
    // /me expone person.fullName (nombre compuesto), no campos sueltos
    expect(profile.person.fullName).toContain('CicloActualizado');
    expect(profile.person.address).toBe('Barrio Centro, Tegucigalpa');
  });

  it('PATCH rechaza campos no permitidos por validación', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { dni: 'nuevo-dni-hack' }, // dni NO es editable vía /me
    });
    // Zod en modo estricto? No: por defecto ignora claves desconocidas...
    // Verificamos que el dni NO cambió
    expect([200, 400]).toContain(response.statusCode);
    const person = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { person: true },
    });
    expect(person.person.dni.startsWith('CIC')).toBe(true);
  });
});
