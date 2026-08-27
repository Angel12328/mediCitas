// Esquemas de validación del módulo de ubicaciones - mediCitas API
import { z } from 'zod';
export const createCountrySchema = z.object({
    name: z.string().min(1).max(100),
});
export const createDepartmentSchema = z.object({
    name: z.string().min(1).max(100),
    countryId: z.string().uuid(),
});
export const createMunicipalitySchema = z.object({
    name: z.string().min(1).max(100),
    departmentId: z.string().uuid(),
});
export const countryQuerySchema = z.object({
    countryId: z.string().uuid('countryId debe ser un UUID válido'),
});
export const departmentQuerySchema = z.object({
    departmentId: z.string().uuid('departmentId debe ser un UUID válido'),
});
export const treeQuerySchema = z.object({
    countryId: z.string().uuid().optional(),
});
export const idParamSchema = z.object({
    id: z.string().uuid(),
});
//# sourceMappingURL=location.schemas.js.map