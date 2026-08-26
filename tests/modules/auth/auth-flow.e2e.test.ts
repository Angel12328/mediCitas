// Test E2E del flujo completo de autenticación (tarea 4.14)
// Registro → perfil → cambio de clave → re-login → forgot → reset (token
// capturado del mailer) → login final → refresh → logout → revocación.
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../src/app.js';
import { prisma } from '../../../src/shared/database/client.js';
import {
  FakeMailer,
  getSeedLocation,
  purgeTestUsers,
  uniqueEmail,
} from '../../helpers/test-utils.js';

const mailer = new FakeMailer();
const app = buildApp({ mailer });
const email = uniqueEmail('e2e');
let password = 'PasswordE2E_1';

afterAll(async () => {
  await purgeTestUsers();
  await app.close();
  await prisma.$disconnect();
});

describe('flujo E2E completo de autenticación', () => {
  it('registro con auto-login y perfil accesible', async () => {
    const location = await getSeedLocation();
    const registered = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password,
        accountType: 'PATIENT',
        bloodType: 'O_POSITIVE',
        person: {
          firstName: 'E2E',
          lastName: 'Flujo',
          birthDate: '1991-11-11',
          dni: `E2E${Date.now()}`,
          gender: 'F',
          ...location,
        },
      },
    });
    expect(registered.statusCode).toBe(201);
    const { accessToken } = JSON.parse(registered.body);

    const profile = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(profile.statusCode).toBe(200);
    expect(JSON.parse(profile.body).patient.bloodType).toBe('O_POSITIVE');
  });

  it('cambio de contraseña invalida sesiones previas', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    const { accessToken, refreshToken } = JSON.parse(login.body);

    const changed = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { currentPassword: password, newPassword: 'PasswordE2E_2' },
    });
    expect(changed.statusCode).toBe(204);

    // El refresh anterior quedó revocado por el cambio de contraseña
    const oldRefresh = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(oldRefresh.statusCode).toBe(401);

    password = 'PasswordE2E_2';
  });

  it('forgot + reset con token del correo + login con nueva clave', async () => {
    const forgot = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      payload: { email },
    });
    expect(forgot.statusCode).toBe(200);
    expect(mailer.sent.at(-1)?.to).toBe(email);
    const rawToken = mailer.sent.at(-1)!.resetToken;

    const reset = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: { token: rawToken, newPassword: 'PasswordE2E_3' },
    });
    expect(reset.statusCode).toBe(204);

    const oldPw = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    expect(oldPw.statusCode).toBe(401);

    const newPw = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'PasswordE2E_3' },
    });
    expect(newPw.statusCode).toBe(200);
    password = 'PasswordE2E_3';
  });

  it('refresh rota, logout revoca y la sesión muere', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    const { refreshToken } = JSON.parse(login.body);

    const rotated = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(rotated.statusCode).toBe(200);
    const newTokens = JSON.parse(rotated.body);

    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${newTokens.accessToken}` },
    });
    expect(me.statusCode).toBe(200);

    const logout = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      payload: { refreshToken: newTokens.refreshToken },
    });
    expect(logout.statusCode).toBe(204);

    const deadSession = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: newTokens.refreshToken },
    });
    expect(deadSession.statusCode).toBe(401);
  });
});
