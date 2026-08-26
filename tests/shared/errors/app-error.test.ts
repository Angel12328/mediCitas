// Tests de AppError y formato RFC 9457 Problem Details (tarea 3.2)
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { AppError } from '../../../src/shared/errors/app-error.js';
import { ERROR_CODES } from '../../../src/shared/errors/codes.js';
import { registerErrorHandler } from '../../../src/shared/errors/handler.js';

describe('AppError', () => {
  it('mapea códigos a estado HTTP y título correctos', () => {
    const notFound = new AppError('NOT_FOUND', 'Cita no encontrada');
    expect(notFound.statusCode).toBe(ERROR_CODES.NOT_FOUND.status);
    expect(notFound.statusCode).toBe(404);
    expect(notFound.title).toBe(ERROR_CODES.NOT_FOUND.title);
  });

  it('produce documento Problem Details con miembros obligatorios RFC 9457', () => {
    const error = new AppError('VALIDATION_ERROR', 'El correo es inválido');
    const problem = error.toProblemDetails('/api/v1/auth/register');

    expect(problem.type).toBe(
      'https://medicitas.example.com/problems/validation-error'
    );
    expect(typeof problem.title).toBe('string');
    expect(problem.status).toBe(400);
    expect(problem.detail).toBe('El correo es inválido');
    expect(problem.instance).toBe('/api/v1/auth/register');
    // Miembros obligatorios presentes
    expect(problem).toHaveProperty('type');
    expect(problem).toHaveProperty('title');
    expect(problem).toHaveProperty('status');
  });

  it('usa el título como mensaje cuando no se provee detail', () => {
    const problem = new AppError('UNAUTHORIZED').toProblemDetails();
    expect(problem.detail).toBeUndefined();
  });
});

describe('manejador global de errores (integración Fastify)', () => {
  async function buildApp() {
    const app = Fastify({ logger: false });
    registerErrorHandler(app);
    app.get('/test/not-found', async () => {
      throw new AppError('NOT_FOUND', 'La cita solicitada no existe');
    });
    app.get('/test/crash', async () => {
      throw new Error('fuga de detalles internos');
    });
    await app.ready();
    return app;
  }

  it('responde errores de aplicación con application/problem+json', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/test/not-found',
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');

    const body = JSON.parse(response.body) as Record<string, unknown>;
    expect(body['status']).toBe(404);
    expect(body['title']).toBe('Recurso no encontrado');
    expect(body['detail']).toBe('La cita solicitada no existe');
    expect(body['instance']).toBe('/test/not-found');
    expect(String(body['type'])).toMatch(/^https:\/\//);
    await app.close();
  });

  it('oculta errores internos con 500 y detalle genérico', async () => {
    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/test/crash' });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body) as Record<string, unknown>;
    expect(body['title']).toBe('Error interno del servidor');
    expect(JSON.stringify(body)).not.toContain('fuga de detalles internos');
    await app.close();
  });

  it('responde rutas no encontradas con formato Problem Details', async () => {
    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/no/existe' });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
    const body = JSON.parse(response.body) as Record<string, unknown>;
    expect(body['title']).toBe('Recurso no encontrado');
    expect(String(body['detail'])).toContain('/no/existe');
    await app.close();
  });
});
