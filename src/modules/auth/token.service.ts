// Servicio de tokens JWT (access tokens) - mediCitas API
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { getEnv } from '../../shared/config/env.js';
import { AppError } from '../../shared/errors/app-error.js';

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  roles: string[];
}

export interface TokenType {
  accessToken: string;
}

function requireEnvSecret(kind: 'JWT_ACCESS_SECRET'): string {
  const secret = process.env[kind];
  if (!secret) {
    // Fallback a config validada si process.env no está poblado
    const env = getEnv();
    return kind === 'JWT_ACCESS_SECRET' ? env.JWT_ACCESS_SECRET : '';
  }
  return secret;
}

export function signAccessToken(
  payload: { sub: string; roles: string[] },
  expiresIn?: string
): string {
  const env = getEnv();
  const options: SignOptions = {
    expiresIn: (expiresIn ?? env.JWT_ACCESS_EXPIRES_IN) as SignOptions['expiresIn'],
    issuer: 'medicitas-api',
  };
  return jwt.sign(payload, requireEnvSecret('JWT_ACCESS_SECRET'), options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, requireEnvSecret('JWT_ACCESS_SECRET'), {
      issuer: 'medicitas-api',
      // Fijar algoritmo evita ataques de confusión (alg:none, RS256→HS256)
      algorithms: ['HS256'],
    });
    if (typeof decoded === 'string') throw new Error('payload inesperado');
    return decoded as AccessTokenPayload;
  } catch (cause) {
    throw new AppError('UNAUTHORIZED', 'Token de acceso inválido o expirado', { cause });
  }
}

export function decodeAccessToken(token: string): JwtPayload | null {
  return jwt.decode(token) as JwtPayload | null;
}
