// Tests del servicio JWT (tarea 4.2)
import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  decodeAccessToken,
  signAccessToken,
  verifyAccessToken,
} from '../../../src/modules/auth/token.service.js';
import { AppError } from '../../../src/shared/errors/app-error.js';

describe('servicio JWT', () => {
  it('sign → verify roundtrip conserva sub y roles', () => {
    const token = signAccessToken({ sub: 'user-abc', roles: ['PATIENT'] });
    const payload = verifyAccessToken(token);

    expect(payload.sub).toBe('user-abc');
    expect(payload.roles).toEqual(['PATIENT']);
    expect(payload.iss).toBe('medicitas-api');
    expect(payload.exp).toBeDefined();
  });

  it('aplica expiración por defecto de configuración (15m)', () => {
    const token = signAccessToken({ sub: 'u1', roles: [] });
    const payload = verifyAccessToken(token);
    const ttlSeconds = (payload.exp as number) - Math.floor(Date.now() / 1000);

    expect(ttlSeconds).toBeGreaterThan(14 * 60);
    expect(ttlSeconds).toBeLessThanOrEqual(15 * 60);
  });

  it('rechaza tokens expirados con UNAUTHORIZED', () => {
    const expired = jwt.sign(
      { sub: 'u1', roles: [] },
      process.env['JWT_ACCESS_SECRET'] as string,
      { expiresIn: -10 }
    );
    expect(() => verifyAccessToken(expired)).toThrowError(AppError);
    try {
      verifyAccessToken(expired);
    } catch (error) {
      expect((error as AppError).statusCode).toBe(401);
    }
  });

  it('rechaza tokens manipulados (firma inválida)', () => {
    const token = signAccessToken({ sub: 'u1', roles: [] });
    const tampered = `${token.slice(0, -3)}xyz`;
    expect(() => verifyAccessToken(tampered)).toThrowError(AppError);
  });

  it('decode no verifica firma (solo inspección)', () => {
    const token = signAccessToken({ sub: 'u2', roles: ['ADMIN'] });
    const decoded = decodeAccessToken(token);
    expect(decoded?.sub).toBe('u2');

    expect(decodeAccessToken('no-es-jwt')).toBeNull();
  });
});
