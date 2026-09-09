// Esquemas de validación - doctores, especialidades y horarios - mediCitas API
import { z } from 'zod';
export const timeFormat = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato esperado HH:mm');
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
    // Nuevos parámetros para disponibilidad agregada
    withAvailability: z.coerce.boolean().optional(),
    daysAhead: z.coerce.number().int().min(1).max(90).optional().default(30),
    sort: z.enum(['availability', 'name', 'createdAt']).optional(),
    filter: z.enum(['hasAvailabilityThisWeek']).optional(),
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
export const availabilityQuerySchema = z
    .object({
    doctorId: z.string().uuid(),
    specialtyId: z.string().uuid(),
    // Modo fecha única (existente)
    date: z.string().date('Formato esperado YYYY-MM-DD').optional(),
    // Modo batch por rango (nuevo) - requiere scheduleId + rango
    scheduleId: z.string().uuid().optional(),
    startDate: z.string().date('Formato esperado YYYY-MM-DD').optional(),
    endDate: z.string().date('Formato esperado YYYY-MM-DD').optional(),
})
    .refine((data) => {
    // Validar que se use uno de los dos modos
    const singleDate = Boolean(data.date);
    const batchMode = Boolean(data.scheduleId && data.startDate && data.endDate);
    return singleDate || batchMode;
}, {
    message: 'Debe proporcionar "date" (modo fecha única) O "scheduleId + startDate + endDate" (modo batch)',
    path: ['date'],
});
export const schedulesQuerySchema = z.object({
    doctorId: z.string().uuid().optional(),
    specialtyId: z.string().uuid().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});
//# sourceMappingURL=doctor.schemas.js.map