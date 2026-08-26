// Esquemas de validación - administración de usuarios y roles - mediCitas API
import { z } from 'zod';
import { passwordSchema, registerPersonSchema } from '../auth/auth.schemas.js';

export const createRoleSchema = z.object({
  name: z.string().min(2).max(50).toUpperCase(),
  description: z.string().max(255).optional(),
});

export const updateRoleSchema = z.object({
  name: z.string().min(2).max(50).toUpperCase().optional(),
  description: z.string().max(255).nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const assignRoleSchema = z.object({
  roleId: z.string().uuid(),
});

export const userIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const userRoleParamsSchema = z.object({
  id: z.string().uuid(),
  roleId: z.string().uuid(),
});

export const userListQuerySchema = z.object({
  email: z.string().max(150).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  role: z.string().max(50).optional(),
});

// ==================== ADMIN: alta manual y estado ====================

/** Alta manual de cuenta por ADMIN (POST /users) */
export const createAdminUserSchema = z
  .object({
    email: z.string().email().max(150),
    password: passwordSchema,
    accountType: z.enum(['PATIENT', 'EMPLOYEE']),
    bloodType: z
      .enum([
        'A_POSITIVE',
        'A_NEGATIVE',
        'B_POSITIVE',
        'B_NEGATIVE',
        'AB_POSITIVE',
        'AB_NEGATIVE',
        'O_POSITIVE',
        'O_NEGATIVE',
      ])
      .optional(),
    roleNames: z
      .array(z.enum(['PATIENT', 'DOCTOR', 'ADMIN', 'EMPLOYEE']))
      .min(1, 'Asigna al menos un rol')
      .max(5),
    person: registerPersonSchema,
  })
  .refine((data) => data.accountType !== 'PATIENT' || data.bloodType !== undefined, {
    message: 'bloodType es requerido para pacientes',
    path: ['bloodType'],
  });

export type CreateAdminUserInput = z.infer<typeof createAdminUserSchema>;

/** Activar/desactivar cuenta de usuario (PATCH /users/:id/status) */
export const updateUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']),
});
