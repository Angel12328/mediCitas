// @ts-nocheck
// Esquemas de validación - citas médicas - mediCitas API
import { z } from 'zod';
export const bookAppointmentSchema = z.object({
  scheduleId: z.string().uuid(),
  date: z.string().date('Formato esperado YYYY-MM-DD'),
});
export const appointmentIdParamSchema = z.object({ id: z.string().uuid() });
export const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']),
});
export const addObservationSchema = z.object({
  observation: z.string().min(1).max(500),
});
export const appointmentsQuerySchema = z.object({
  date: z.string().date().optional(),
  patientId: z.string().uuid().optional(),
  doctorId: z.string().uuid().optional(),
  scheduleId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
});
//# sourceMappingURL=appointment.schemas.js.map
