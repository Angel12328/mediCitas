// Tipos de autenticación para Fastify - mediCitas API
import 'fastify';

export type RoleName = 'ADMIN' | 'DOCTOR' | 'PATIENT' | 'EMPLOYEE';

export interface AuthenticatedUser {
  id: string;
  roles: RoleName[];
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}
