// @ts-nocheck
// Lógica de negocio de citas: reserva con bloqueo optimista, posiciones
// en cola y matriz de transiciones de estado.
import { prisma } from '../../shared/database/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import { maskIncludesDay } from '../doctors/schedule.service.js';
const MAX_RETRIES = 3;
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
 * 2. Incrementa `version` del horario de forma condicionada (optimistic lock).
 * 3. Verifica capacidad y unicidad del paciente dentro de la transacción.
 * 4. Asigna posición = máx(posiciones activas) + 1.
 * Reintenta hasta MAX_RETRIES ante conflicto de concurrencia.
 */
export async function bookAppointment(input) {
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
            // Bloqueo optimista: solo uno gana si la versión cambió
            const lock = await tx.schedule.updateMany({
                where: { id: schedule.id, version: schedule.version },
                data: { version: { increment: 1 } },
            });
            if (lock.count === 0) {
                throw new AppError('CONFLICT', 'Concurrencia al reservar; reintenta', {
                    details: { retryable: true },
                });
            }
            // Capacidad
            const bookedCount = await tx.appointment.count({
                where: {
                    scheduleId: schedule.id,
                    date: new Date(`${input.date}T00:00:00Z`),
                    deletedAt: null,
                    status: { in: [...OCCUPYING_STATUSES] },
                },
            });
            if (bookedCount >= schedule.slotCapacity) {
                throw new AppError('CONFLICT', 'El cupo para esa fecha está completo');
            }
            // Doble reserva del mismo paciente en mismo horario/fecha
            const duplicate = await tx.appointment.findFirst({
                where: {
                    patientId: input.patientId,
                    scheduleId: schedule.id,
                    date: new Date(`${input.date}T00:00:00Z`),
                    deletedAt: null,
                    status: { in: [...OCCUPYING_STATUSES] },
                },
            });
            if (duplicate) {
                throw new AppError('CONFLICT', 'Ya tienes una cita reservada en este horario para esa fecha');
            }
            // Posición en cola: máx sobre TODAS las filas no eliminadas del
            // horario+fecha (incluye canceladas) para respetar el constraint
            // único (scheduleId, date, position) y evitar colisiones.
            const maxPosition = await tx.appointment.aggregate({
                _max: { position: true },
                where: {
                    scheduleId: schedule.id,
                    date: new Date(`${input.date}T00:00:00Z`),
                    deletedAt: null,
                },
            });
            const position = (maxPosition._max.position ?? 0) + 1;
            const appointment = await tx.appointment.create({
                data: {
                    patientId: input.patientId,
                    scheduleId: schedule.id,
                    date: new Date(`${input.date}T00:00:00Z`),
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
/**
 * Matriz de transiciones válidas y roles autorizados por transición.
 * OWNER = paciente dueño de la cita; STAFF = DOCTOR o ADMIN.
 */
export const TRANSITIONS = {
    PENDING: {
        CONFIRMED: 'STAFF',
        CANCELLED: 'ANY', // owner cancela; staff también
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