// Esquemas de validación - empleados y cargos - mediCitas API
import { z } from 'zod';
export const createCargoSchema = z.object({
    name: z.string().min(2).max(80),
});
export const updateCargoSchema = z.object({
    name: z.string().min(2).max(80).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});
export const cargoIdParamSchema = z.object({
    id: z.string().uuid(),
});
export const createEmployeeSchema = z.object({
    userId: z.string().uuid(),
});
export const updateEmployeeSchema = z.object({
    status: z.enum(['ACTIVE', 'INACTIVE']),
});
export const employeeIdParamSchema = z.object({
    id: z.string().uuid(),
});
export const employeeQuerySchema = z.object({
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    role: z.string().max(50).optional(),
});
export const assignCargoSchema = z.object({
    cargoId: z.string().uuid(),
});
//# sourceMappingURL=employee.schemas.js.map