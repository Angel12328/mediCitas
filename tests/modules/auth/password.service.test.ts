// Tests del servicio de contraseñas (tarea 4.1)
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../../src/modules/auth/password.service.js';

describe('servicio de contraseñas (Argon2id)', () => {
  it('hace roundtrip: hash → verify correcto', async () => {
    const passwordHash = await hashPassword('S3gura!2026');
    expect(passwordHash).toMatch(/^\$argon2id\$/);

    const isValid = await verifyPassword(passwordHash, 'S3gura!2026');
    expect(isValid).toBe(true);
  });

  it('rechaza contraseña incorrecta sin lanzar error', async () => {
    const passwordHash = await hashPassword('correcta-horse-battery');
    const result = await verifyPassword(passwordHash, 'incorrecta');
    expect(result).toBe(false);
  });

  it('genera hashes distintos para la misma contraseña (salt único)', async () => {
    const hash1 = await hashPassword('misma-clave');
    const hash2 = await hashPassword('misma-clave');
    expect(hash1).not.toBe(hash2);
    expect(await verifyPassword(hash1, 'misma-clave')).toBe(true);
    expect(await verifyPassword(hash2, 'misma-clave')).toBe(true);
  });
});
