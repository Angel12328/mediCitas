// Tests de guards: autenticación, RBAC y propiedad (tareas 4.11 y 4.12)
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import {
  authenticate,
  requireRoles,
  requireSelfOrAdmin,
} from '../../../src/shared/auth/guards.js';
import { signAccessToken } from '../../../src/modules/auth/token.service.js';
import { registerErrorHandler } from '../../../src/shared/errors/handler.js';

async function buildApp() {
  const app = Fastify({ logger: false });
  registerErrorHandler(app);

  app.get(
    '/test/admin-only',
    { preHandler: [authenticate, requireRoles('ADMIN')] },
    async (request) => ({ viewer: request.user?.id })
  );

  app.get(
    '/test/staff',
    { preHandler: [authenticate, requireRoles('ADMIN', 'DOCTOR', 'EMPLOYEE')] },
    async (request) => ({ roles: request.user?.roles })
  );

  app.get(
    '/test/own/:userId',
    { preHandler: [authenticate, requireSelfOrAdmin('userId')] },
    async () => ({ ok: true })
  );

  await app.ready();
  return app;
}

function bearer(userId: string, roles: string[]): Record<string, string> {
  return { authorization: `Bearer ${signAccessToken({ sub: userId, roles })}` };
}

describe('guard de autenticación', () => {
  it('rechaza requests sin token con UNAUTHORIZED', async () => {
    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/test/admin-only' });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('rechaza tokens inválidos con UNAUTHORIZED', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/test/admin-only',
      headers: { authorization: 'Bearer token-basura' },
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });
});

describe('middleware RBAC (role guard)', () => {
  it('permite acceso a rol autorizado (ADMIN)', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/test/admin-only',
      headers: bearer('admin-1', ['ADMIN']),
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ viewer: 'admin-1' });
    await app.close();
  });

  it('bloquea rol no autorizado con FORBIDDEN (PATIENT en ruta admin)', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/test/admin-only',
      headers: bearer('patient-1', ['PATIENT']),
    });
    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body)['detail']).toContain('roles');
    await app.close();
  });

  it('acepta cualquiera de varios roles permitidos', async () => {
    const app = await buildApp();
    for (const role of ['DOCTOR', 'EMPLOYEE']) {
      const response = await app.inject({
        method: 'GET',
        url: '/test/staff',
        headers: bearer(`user-${role}`, [role]),
      });
      expect(response.statusCode).toBe(200);
    }
    const denied = await app.inject({
      method: 'GET',
      url: '/test/staff',
      headers: bearer('p1', ['PATIENT']),
    });
    expect(denied.statusCode).toBe(403);
    await app.close();
  });
});

describe('guard de propiedad de recursos', () => {
  it('permite acceso al dueño del recurso', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/test/own/user-123',
      headers: bearer('user-123', ['PATIENT']),
    });
    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it('deniega acceso a recurso ajeno con FORBIDDEN', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/test/own/user-999',
      headers: bearer('user-123', ['PATIENT']),
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('ADMIN puede acceder a recursos ajenos', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/test/own/user-999',
      headers: bearer('admin-7', ['ADMIN']),
    });
    expect(response.statusCode).toBe(200);
    await app.close();
  });
});
