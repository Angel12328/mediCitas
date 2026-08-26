// Tests del módulo de configuración (tarea 3.6)
import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../../src/shared/config/env.js';

const validEnv = {
  NODE_ENV: 'production',
  PORT: '8080',
  DATABASE_URL: 'postgresql://medicitas:secret@localhost:5433/medicitas',
  JWT_ACCESS_SECRET: 'secreto-acceso-suficientemente-largo',
  JWT_REFRESH_SECRET: 'secreto-refresh-suficientemente-largo',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
};

describe('módulo de configuración con Zod', () => {
  it('carga y coercea variables válidas', () => {
    const env = loadEnv(validEnv);

    expect(env.PORT).toBe(8080); // string → number
    expect(env.NODE_ENV).toBe('production');
    expect(env.DATABASE_URL).toContain('postgresql://');
    expect(env.LOG_LEVEL).toBe('info'); // default
  });

  it('aplica valores por defecto para opcionales', () => {
    const env = loadEnv({
      DATABASE_URL: 'postgresql://medicitas:secret@localhost:5433/medicitas',
      JWT_ACCESS_SECRET: 'secreto-acceso-suficientemente-largo',
      JWT_REFRESH_SECRET: 'secreto-refresh-suficientemente-largo',
    });

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.JWT_ACCESS_EXPIRES_IN).toBe('15m');
    expect(env.JWT_REFRESH_EXPIRES_IN).toBe('7d');
  });

  it('falla si falta DATABASE_URL, listando el problema', () => {
    const incomplete = { ...validEnv } as Record<string, string>;
    delete incomplete['DATABASE_URL'];

    expect(() => loadEnv(incomplete)).toThrow(/DATABASE_URL/);
  });

  it('rechaza secretos cortos y formatos de expiración inválidos', () => {
    expect(() =>
      loadEnv({ ...validEnv, JWT_ACCESS_SECRET: 'corto' })
    ).toThrow();

    expect(() =>
      loadEnv({ ...validEnv, JWT_ACCESS_EXPIRES_IN: 'quince' })
    ).toThrow(/formato esperado/);
  });
});
