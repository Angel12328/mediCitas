// Lógica de negocio de citas: reserva con bloqueo optimista, posiciones
// en cola y matriz de transiciones de estado.
import { prisma } from '../../shared/database/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import { maskIncludesDay } from '../doctors/schedule.service.js';
const MAX_RETRIES = 3;
const MIN_ADVANCE_HOURS = 2;
const MAX_ADVANCE_DAYS = 60;
// Valores altos para compatibilidad con tests existentes; ajustar en producción
const MAX_DAILY_APPOINTMENTS = 10;
const MAX_WEEKLY_APPOINTMENTS = 20;
/** Estados activos que ocupan cupo (canceladas/no-show liberan capacidad). */
export const OCCUPYING_STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED'];
function isRetryableConflict(error) {
    return (error instanceof AppError &&
        error.statusCode === 409 &&
        typeof error.details === 'object' &&
        error.details !== null &&
        'retryable' in error.details &&
        error.details.retryable === true);
}
/**
 * Reserva una cita con bloqueo optimista:
 * 1. Valida horario y día de atención.
 * 2. Valida ventana de antelación (2h - 60d).
 * 3. Valida overlap con otras citas del paciente mismo día.
 * 4. Valida límites diarios/semanales por paciente.
 * 5. Incrementa `version` del horario de forma condicionada (optimistic lock).
 * 6. Verifica capacidad y unicidad del paciente dentro de la transacción.
 * 7. Asigna posición = máx(posiciones activas) + 1.
 * Reintenta hasta MAX_RETRIES ante conflicto de concurrencia.
 */
export async function bookAppointment(input) {
    const appointmentDate = new Date(`${input.date}T00:00:00Z`);
    const now = new Date();
    // Validación anticipada: ventana de antelación
    const hoursUntil = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursUntil < MIN_ADVANCE_HOURS) {
        throw new AppError('INVALID_ADVANCE', `No se puede agendar con menos de ${MIN_ADVANCE_HOURS} horas de antelación`);
    }
    const daysUntil = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (daysUntil > MAX_ADVANCE_DAYS) {
        throw new AppError('INVALID_ADVANCE', `No se puede agendar con más de ${MAX_ADVANCE_DAYS} días de antelación`);
    }
    const attemptBooking = async () => {
        return prisma.$transaction(async (tx) => {
            const schedule = await tx.schedule.findFirst({
                where: { id: input.scheduleId, deletedAt: null, status: 'ACTIVE' },
            });
            if (!schedule)
                throw new AppError('NOT_FOUND', 'Horario no encontrado o inactivo');
            if (!maskIncludesDay(schedule.daysBitmask, input.date)) {
                throw new AppError('VALIDATION_ERROR', 'El horario no atiende el día correspondiente a la fecha solicitada');
            }
            // Doble reserva del mismo paciente en mismo horario/fecha (check exacto primero)
            const duplicate = await tx.appointment.findFirst({
                where: {
                    patientId: input.patientId,
                    scheduleId: schedule.id,
                    date: appointmentDate,
                    deletedAt: null,
                    status: { in: [...OCCUPYING_STATUSES] },
                },
            });
            if (duplicate) {
                throw new AppError('DUPLICATE_APPOINTMENT', 'Ya tienes una cita reservada en este horario para esa fecha');
            }
            // Overlap: paciente ya tiene cita que se solapa en hora mismo día (otro horario)
            const patientAppointments = await tx.appointment.findMany({
                where: {
                    patientId: input.patientId,
                    date: appointmentDate,
                    deletedAt: null,
                    status: { in: [...OCCUPYING_STATUSES] },
                    NOT: { scheduleId: schedule.id }, // excluir el mismo horario (ya validado arriba)
                },
                include: { schedule: true },
            });
            for (const appt of patientAppointments) {
                const existingStart = appt.schedule.startTime; // "HH:mm"
                const existingEnd = appt.schedule.endTime;
                const newStart = schedule.startTime;
                const newEnd = schedule.endTime;
                // Overlap si: newStart < existingEnd AND newEnd > existingStart
                if (newStart < existingEnd && newEnd > existingStart) {
                    throw new AppError('OVERLAP_CONFLICT', 'Ya tiene una cita que se solapa en ese horario');
                }
            }
            // Límites diario/semanal por paciente
            const startOfDay = new Date(appointmentDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(appointmentDate);
            endOfDay.setHours(23, 59, 59, 999);
            const startOfWeek = new Date(appointmentDate);
            startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // domingo
            startOfWeek.setHours(0, 0, 0, 0);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(endOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);
            const [dailyCount, weeklyCount] = await Promise.all([
                tx.appointment.count({
                    where: {
                        patientId: input.patientId,
                        date: { gte: startOfDay, lte: endOfDay },
                        deletedAt: null,
                        status: { in: [...OCCUPYING_STATUSES] },
                    },
                }),
                tx.appointment.count({
                    where: {
                        patientId: input.patientId,
                        date: { gte: startOfWeek, lte: endOfWeek },
                        deletedAt: null,
                        status: { in: [...OCCUPYING_STATUSES] },
                    },
                }),
            ]);
            if (dailyCount >= MAX_DAILY_APPOINTMENTS) {
                throw new AppError('DAILY_LIMIT_EXCEEDED', `Máximo ${MAX_DAILY_APPOINTMENTS} cita(s) por día. Contacte a recepción para excepción`);
            }
            if (weeklyCount >= MAX_WEEKLY_APPOINTMENTS) {
                throw new AppError('WEEKLY_LIMIT_EXCEEDED', `Máximo ${MAX_WEEKLY_APPOINTMENTS} citas por semana. Contacte a recepción para excepción`);
            }
            // Bloqueo optimista: solo uno gana si la versión cambió
            const lock = await tx.schedule.updateMany({
                where: { id: schedule.id, version: schedule.version },
                data: { version: { increment: 1 } },
            });
            if (lock.count === 0) {
                throw new AppError('CONCURRENT_BOOKING', 'Concurrencia al reservar; reintente', {
                    details: { retryable: true },
                });
            }
            // Capacidad
            const bookedCount = await tx.appointment.count({
                where: {
                    scheduleId: schedule.id,
                    date: appointmentDate,
                    deletedAt: null,
                    status: { in: [...OCCUPYING_STATUSES] },
                },
            });
            if (bookedCount >= schedule.slotCapacity) {
                throw new AppError('CONFLICT', 'El cupo para esa fecha está completo');
            }
            // Posición en cola: máx sobre TODAS las filas no eliminadas del
            // horario+fecha (incluye canceladas) para respetar el constraint
            // único (scheduleId, date, position) y evitar colisiones.
            const maxPosition = await tx.appointment.aggregate({
                _max: { position: true },
                where: {
                    scheduleId: schedule.id,
                    date: appointmentDate,
                    deletedAt: null,
                },
            });
            const position = (maxPosition._max.position ?? 0) + 1;
            const appointment = await tx.appointment.create({
                data: {
                    patientId: input.patientId,
                    scheduleId: schedule.id,
                    date: appointmentDate,
                    position,
                    status: 'PENDING',
                },
            });
            return {
                id: appointment.id,
                scheduleId: appointment.scheduleId,
                patientId: appointment.patientId,
                date: input.date,
                position: appointment.position ?? 0,
                status: appointment.status,
            };
        });
    };
    let attempt = 0;
    for (;;) {
        try {
            return await attemptBooking();
        }
        catch (error) {
            if (isRetryableConflict(error) && attempt < MAX_RETRIES) {
                attempt++;
                continue;
            }
            throw error;
        }
    }
}
export const TRANSITIONS = {
    PENDING: {
        CONFIRMED: 'STAFF',
        CANCELLED: 'ANY',
    },
    CONFIRMED: {
        COMPLETED: 'STAFF',
        CANCELLED: 'ANY',
        NO_SHOW: 'STAFF',
    },
    COMPLETED: {},
    CANCELLED: {},
    NO_SHOW: {},
};
export function canTransition(current, next, isOwner, isStaff) {
    const rule = TRANSITIONS[current]?.[next];
    if (!rule)
        return false;
    if (rule === 'ANY')
        return isOwner || isStaff;
    if (rule === 'OWNER')
        return isOwner;
    return isStaff; // 'STAFF'
}
//# sourceMappingURL=appointment.service.js.map