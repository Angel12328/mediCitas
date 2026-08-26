// Test de conexión del cliente Prisma singleton (tarea 3.1)
import { describe, expect, it } from 'vitest';
import { createPrismaClient, prisma } from '../../../src/shared/database/client.js';

describe('cliente de base de datos (singleton)', () => {
  it('conecta y consulta datos sembrados (roles = 4)', async () => {
    const rolesCount = await prisma.role.count();
    expect(rolesCount).toBeGreaterThanOrEqual(4);
  });

  it('retorna la misma instancia en importaciones repetidas (singleton)', async () => {
    const { prisma: second } = await import('../../../src/shared/database/client.js');
    expect(second).toBe(prisma);
  });

  it('lanza error si no hay DATABASE_URL', () => {
    const original = process.env['DATABASE_URL'];
    delete process.env['DATABASE_URL'];
    expect(() => createPrismaClient()).toThrow('DATABASE_URL');
    process.env['DATABASE_URL'] = original;
  });
});
