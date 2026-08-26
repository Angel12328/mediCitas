// Servicio de sesiones: refresh tokens con rotación y detección de reuso
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { User } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/database/client.js';
import { AppError } from '../../shared/errors/app-error.js';

const REFRESH_TOKEN_TTL_DAYS = 7;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function generateOpaqueToken(): string {
  return randomBytes(48).toString('base64url');
}

export interface TokenPair {
  refreshToken: string;
}

/**
 * Emite un nuevo refresh token para el usuario.
 * @param familyId Familia de rotación; nueva si se omite (login/registro)
 */
export async function issueRefreshToken(
  userId: string,
  familyId?: string
): Promise<TokenPair> {
  const raw = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: sha256(raw),
      familyId: familyId ?? randomUUID(),
      expiresAt,
    },
  });

  return { refreshToken: raw };
}

export interface RotationResult {
  refreshToken: string;
  user: Pick<User, 'id' | 'email' | 'status'>;
}

/**
 * Rota un refresh token:
 * - Válido y no revocado → revoca y emite uno nuevo de la misma familia.
 * - Ya revocado (REUSO) → revoca toda la familia y lanza UNAUTHORIZED.
 * - Inexistente o expirado → UNAUTHORIZED.
 */
export async function rotateRefreshToken(rawToken: string): Promise<RotationResult> {
  const tokenHash = sha256(rawToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!stored) {
    throw new AppError('UNAUTHORIZED', 'Refresh token inválido');
  }

  // Detección de reuso: un token ya revocado vuelve a presentarse
  if (stored.revokedAt !== null) {
    await prisma.refreshToken.updateMany({
      where: { familyId: stored.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new AppError('UNAUTHORIZED', 'Refresh token reutilizado: familia revocada');
  }

  if (stored.expiresAt.getTime() < Date.now()) {
    throw new AppError('UNAUTHORIZED', 'Refresh token expirado');
  }

  if (stored.user.status !== 'ACTIVE') {
    throw new AppError('FORBIDDEN', 'La cuenta no está activa');
  }

  const { refreshToken } = await issueRefreshToken(stored.userId, stored.familyId);
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  return {
    refreshToken,
    user: { id: stored.user.id, email: stored.user.email, status: stored.user.status },
  };
}

/** Revoca un token concreto (logout). Idempotente. */
export async function revokeRefreshToken(rawToken: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: sha256(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Revoca todas las sesiones activas del usuario (cambio/restablecimiento de contraseña). */
export async function revokeAllUserSessions(userId: string): Promise<number> {
  const result = await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
}
