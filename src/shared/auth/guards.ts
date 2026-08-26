// Guards de autenticación, RBAC y propiedad de recursos - mediCitas API
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../errors/app-error.js';
import { verifyAccessToken } from '../../modules/auth/token.service.js';
import type { AuthenticatedUser, RoleName } from './types.js';

/**
 * Hook preValidation que autentica vía Bearer JWT.
 * Adjunta request.user = { id, roles } desde el payload del token.
 */
export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError('UNAUTHORIZED', 'Se requiere token de acceso (Bearer)');
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const payload = verifyAccessToken(token);

  request.user = {
    id: payload.sub,
    roles: (payload.roles ?? []) as RoleName[],
  };
}

/**
 * Fábrica de hook RBAC: permite el paso solo a usuarios autenticados
 * con al menos uno de los roles indicados. ADMIN siempre pasa si se incluye.
 * Debe ejecutarse DESPUÉS de `authenticate`.
 */
export function requireRoles(...allowed: RoleName[]) {
  return async function roleGuard(request: FastifyRequest): Promise<void> {
    const user: AuthenticatedUser | undefined = request.user;
    if (!user) {
      throw new AppError('UNAUTHORIZED', 'No autenticado');
    }
    const hasRole = user.roles.some((role) => allowed.includes(role));
    if (!hasRole) {
      throw new AppError('FORBIDDEN', `Requiere uno de los roles: ${allowed.join(', ')}`);
    }
  };
}

/**
 * Verifica propiedad de recurso: el usuario autenticado debe ser dueño
 * del recurso o tener rol ADMIN. Lanza FORBIDDEN en caso contrario.
 * @param resourceOwnerId ID del dueño del recurso
 */
export function ensureSelfOrAdmin(requestUser: AuthenticatedUser, resourceOwnerId: string): void {
  if (requestUser.id === resourceOwnerId) return;
  if (requestUser.roles.includes('ADMIN')) return;
  throw new AppError('FORBIDDEN', 'Solo puedes acceder a tus propios recursos');
}

/**
 * Fábrica de hook para rutas con :userId en params:
 * valida que el usuario autenticado sea ese usuario o ADMIN.
 */
export function requireSelfOrAdmin(paramName = 'userId') {
  return async function selfGuard(request: FastifyRequest): Promise<void> {
    const user = request.user;
    if (!user) {
      throw new AppError('UNAUTHORIZED', 'No autenticado');
    }
    const params = request.params as Record<string, string>;
    const ownerId = params[paramName];
    if (!ownerId) {
      throw new AppError('VALIDATION_ERROR', `Parámetro '${paramName}' requerido`);
    }
    ensureSelfOrAdmin(user, ownerId);
  };
}
