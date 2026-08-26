// Tests del middleware de validación Zod (tarea 3.3)
import Fastify from 'fastify';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { registerErrorHandler } from '../../../src/shared/errors/handler.js';
import { validate } from '../../../src/shared/validation/validate.js';

const patientSchema = z.object({
  email: z.string().email(),
  birthDate: z.string().date(),
  bloodType: z.enum(['A_POSITIVE', 'O_NEGATIVE']),
});

async function buildApp() {
  const app = Fastify({ logger: false });
  registerErrorHandler(app);

  app.post(
    '/test/patients',
    { preHandler: validate({ body: patientSchema }) },
    async (request) => ({ received: request.body })
  );

  app.get(
    '/test/query',
    { preHandler: validate({ query: z.object({ page: z.coerce.number().int().min(1) }) }) },
    async (request) => ({ received: request.query })
  );

  await app.ready();
  return app;
}

describe('middleware de validación Zod', () => {
  it('acepta y parsea un body válido', async () => {
    const app = await buildApp();
    const payload = {
      email: 'paciente@medicitas.com',
      birthDate: '1995-03-20',
      bloodType: 'O_NEGATIVE',
    };
    const response = await app.inject({ method: 'POST', url: '/test/patients', payload });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ received: payload });
    await app.close();
  });

  it('rechaza body inválido con 400 y detalles por campo', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/test/patients',
      payload: { email: 'no-es-correo', birthDate: '20-03-1995', bloodType: 'XYZ' },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body) as { details: Array<Record<string, unknown>> };
    expect(body['title']).toBeDefined();
    expect(body['status']).toBe(400);
    const fields = body.details.map((d) => d['field']);
    expect(fields).toContain('email');
    expect(fields).toContain('birthDate');
    expect(fields).toContain('bloodType');
    await app.close();
  });

  it('valida y coercea query strings (page=2 → número)', async () => {
    const app = await buildApp();
    const ok = await app.inject({ method: 'GET', url: '/test/query?page=2' });
    expect(ok.statusCode).toBe(200);
    expect(JSON.parse(ok.body)).toEqual({ received: { page: 2 } });

    const bad = await app.inject({ method: 'GET', url: '/test/query?page=cero' });
    expect(bad.statusCode).toBe(400);
    await app.close();
  });
});
