// Esquemas de validación - doctores, especialidades y horarios - mediCitas API
import { z } from 'zod';
export const timeFormat = z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato esperado HH:mm');
export const daysBitmaskSchema = z
    .number()
    .int()
    .min(1, 'Debe haber al menos un día de atención')
    .max(127, 'Máximo 7 días (bits 0=lunes … 6=domingo)');
export const createSpecialtySchema = z.object({
    name: z.string().min(2).max(100),
});
export const updateSpecialtySchema = z.object({
    name: z.string().min(2).max(100).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});
export const specialtyIdParamSchema = z.object({ id: z.string().uuid() });
export const createDoctorSchema = z.object({
    employeeId: z.string().uuid(),
});
export const doctorIdParamSchema = z.object({ id: z.string().uuid() });
export const updateDoctorSchema = z.object({
    status: z.enum(['ACTIVE', 'INACTIVE']),
});
export const assignSpecialtySchema = z.object({
    specialtyId: z.string().uuid(),
});
export const doctorSpecialtyParamsSchema = z.object({
    id: z.string().uuid(),
    specialtyId: z.string().uuid(),
});
export const doctorsQuerySchema = z.object({
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    specialtyId: z.string().uuid().optional(),
});
export const createScheduleSchema = z
    .object({
    doctorId: z.string().uuid(),
    specialtyId: z.string().uuid(),
    daysBitmask: daysBitmaskSchema,
    startTime: timeFormat,
    endTime: timeFormat,
    slotCapacity: z.number().int().min(1).max(200),
    observation: z.string().max(255).optional(),
    timezone: z.string().max(50).optional(),
})
    .refine((data) => data.startTime < data.endTime, {
    message: 'La hora de inicio debe ser anterior a la hora de fin',
    path: ['endTime'],
});
export const updateScheduleSchema = z
    .object({
    daysBitmask: daysBitmaskSchema.optional(),
    startTime: timeFormat.optional(),
    endTime: timeFormat.optional(),
    slotCapacity: z.number().int().min(1).max(200).optional(),
    observation: z.string().max(255).nullable().optional(),
})
    .refine((data) => !data.startTime || !data.endTime || data.startTime < data.endTime, {
    message: 'La hora de inicio debe ser anterior a la hora de fin',
    path: ['endTime'],
});
export const scheduleIdParamSchema = z.object({ id: z.string().uuid() });
export const availabilityQuerySchema = z.object({
    doctorId: z.string().uuid(),
    specialtyId: z.string().uuid(),
    date: z.string().date('Formato esperado YYYY-MM-DD'),
});
export const schedulesQuerySchema = z.object({
    doctorId: z.string().uuid().optional(),
    specialtyId: z.string().uuid().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});
//# sourceMappingURL=doctor.schemas.js.map