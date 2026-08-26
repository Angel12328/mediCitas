// Tests de rotación de refresh tokens y detección de reuso (tarea 4.3)
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../../../src/shared/database/client.js';
import {
  issueRefreshToken,
  revokeAllUserSessions,
  revokeRefreshToken,
  rotateRefreshToken,
} from '../../../src/modules/auth/session.service.js';
import { AppError } from '../../../src/shared/errors/app-error.js';

const TEST_EMAIL = `session-test-${Date.now()}@auth-test.local`;
let testUserId: string;

afterAll(async () => {
  // Limpieza en orden de dependencias
  await prisma.refreshToken.deleteMany({ where: { user: { email: TEST_EMAIL } } });
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  await prisma.$disconnect();
});

async function createTestUser(): Promise<string> {
  const person = await prisma.person.create({
    data: {
      firstName: 'Sesión',
      lastName: 'De Prueba',
      birthDate: new Date('1990-01-01'),
      dni: `SS${Date.now()}`,
      gender: 'M',
      countryId: (await prisma.country.findFirstOrThrow({ where: { name: 'Honduras' } })).id,
      departmentId: (
        await prisma.department.findFirstOrThrow({ where: { name: 'Francisco Morazán' } })
      ).id,
      municipalityId: (
        await prisma.municipality.findFirstOrThrow({ where: { name: 'Tegucigalpa' } })
      ).id,
    },
  });
  const user = await prisma.user.create({
    data: {
      personId: person.id,
      email: TEST_EMAIL,
      passwordHash: '$argon2id$placeholder',
    },
  });
  testUserId = user.id;
  return user.id;
}

describe('sesiones: rotación y detección de reuso', () => {
  it('emite refresh token almacenado hasheado', async () => {
    await createTestUser();
    const { refreshToken } = await issueRefreshToken(testUserId);

    expect(refreshToken).toHaveLength(64); // base64url de 48 bytes

    const stored = await prisma.refreshToken.findFirstOrThrow({
      where: { userId: testUserId },
    });
    expect(stored.tokenHash).not.toBe(refreshToken);
    expect(stored.tokenHash).toHaveLength(64);
    expect(stored.revokedAt).toBeNull();
  });

  it('rota token válido: emite uno nuevo y revoca el anterior', async () => {
    const first = await issueRefreshToken(testUserId);
    const rotation = await rotateRefreshToken(first.refreshToken);

    expect(rotation.refreshToken).not.toBe(first.refreshToken);
    expect(rotation.user.id).toBe(testUserId);

    // El token original quedó revocado y el nuevo sigue activo
    const tokens = await prisma.refreshToken.findMany({
      where: { userId: testUserId },
      orderBy: { createdAt: 'desc' },
      take: 2,
    });
    expect(tokens[0]?.revokedAt).toBeNull();
    expect(tokens[1]?.revokedAt).not.toBeNull();
  });

  it('detecta reuso: revoca TODA la familia y rechaza el token reusado', async () => {
    // Nueva familia limpia para este caso
    const original = await issueRefreshToken(testUserId);
    const rotated = await rotateRefreshToken(original.refreshToken);

    // El token original ya fue revocado por la rotación → reuso
    await expect(rotateRefreshToken(original.refreshToken)).rejects.toThrowError(AppError);

    // Toda la familia quedó revocada, incluido el token "nuevo"
    const familyTokens = await prisma.refreshToken.findMany({
      where: { userId: testUserId, revokedAt: { not: null } },
    });
    expect(familyTokens.length).toBeGreaterThanOrEqual(2);

    await expect(rotateRefreshToken(rotated.refreshToken)).rejects.toThrow(
      'familia revocada'
    );
  });

  it('rechaza tokens inexistentes con UNAUTHORIZED', async () => {
    await expect(rotateRefreshToken('token-fantasma')).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('logout revoca el token individual; refresh posterior falla', async () => {
    const issued = await issueRefreshToken(testUserId);
    await revokeRefreshToken(issued.refreshToken);

    await expect(rotateRefreshToken(issued.refreshToken)).rejects.toThrowError(AppError);
  });

  it('revoca todas las sesiones del usuario de una vez', async () => {
    await issueRefreshToken(testUserId);
    await issueRefreshToken(testUserId);
    await issueRefreshToken(testUserId);

    const revokedCount = await revokeAllUserSessions(testUserId);
    expect(revokedCount).toBeGreaterThanOrEqual(3);

    const remainingActive = await prisma.refreshToken.count({
      where: { userId: testUserId, revokedAt: null },
    });
    expect(remainingActive).toBe(0);
  });

  void testUserId;
});
