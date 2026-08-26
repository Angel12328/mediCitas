// Esquemas de validación - contactos (extensiones y teléfonos) - mediCitas API
import { z } from 'zod';

export const createExtensionSchema = z.object({
  name: z.string().min(2).max(50),
});

export const updateExtensionSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const extensionIdParamSchema = z.object({ id: z.string().uuid() });

export const createPhoneSchema = z.object({
  number: z.string().min(6).max(20),
  personId: z.string().uuid(),
  extensionId: z.string().uuid(),
});

export const phoneIdParamSchema = z.object({ id: z.string().uuid() });

export const updatePhoneSchema = z.object({
  number: z.string().min(6).max(20).optional(),
  extensionId: z.string().uuid().optional(),
});

export const phonesQuerySchema = z.object({
  personId: z.string().uuid(),
});
