import { authenticate, requireRoles } from '../../shared/auth/guards.js';
import { AppError } from '../../shared/errors/app-error.js';
import { prisma } from '../../shared/database/client.js';
import { buildOffsetPage, parseOffsetQuery } from '../../shared/pagination/pagination.js';
import { availabilityQuerySchema, createScheduleSchema, scheduleIdParamSchema, schedulesQuerySchema, updateScheduleSchema, } from './doctor.schemas.js';
import { findConflictingSchedule, maskIncludesDay, } from './schedule.service.js';
import { validate } from '../../shared/validation/validate.js';
const adminOnly = [authenticate, requireRoles('ADMIN')];
async function loadDoctorSchedules(doctorId) {
    return prisma.schedule.findMany({
        where: { doctorId, deletedAt: null, status: 'ACTIVE' },
        select: {
            id: true,
            doctorId: true,
            specialtyId: true,
            daysBitmask: true,
            startTime: true,
            endTime: true,
            slotCapacity: true,
        },
    });
}
export async function scheduleRoutes(app) {
    /**
     * Disponibilidad de cupos para doctor/especialidad/fecha.
     * Excluye horarios completos y citas canceladas liberan cupo.
     * Debe declararse ANTES de la ruta paramétrica /:id.
     */
    app.get('/availability', { preHandler: [authenticate, validate({ query: availabilityQuerySchema })] }, async (request) => {
        const { doctorId, specialtyId, date } = request.query;
        const schedules = (await loadDoctorSchedules(doctorId)).filter((s) => s.specialtyId === specialtyId && maskIncludesDay(s.daysBitmask, date));
        if (schedules.length === 0) {
            return { date, items: [], message: 'Sin horarios disponibles para esa fecha' };
        }
        const booked = await prisma.appointment.groupBy({
            by: ['scheduleId'],
            where: {
                scheduleId: { in: schedules.map((s) => s.id) },
                date: new Date(`${date}T00:00:00Z`),
                deletedAt: null,
                status: { notIn: ['CANCELLED', 'NO_SHOW'] },
            },
            _count: { _all: true },
        });
        const bookedBySchedule = new Map(booked.map((b) => [b.scheduleId, b._count._all]));
        const items = schedules
            .map((s) => ({
            scheduleId: s.id,
            startTime: s.startTime,
            endTime: s.endTime,
            slotCapacity: s.slotCapacity,
            booked: bookedBySchedule.get(s.id) ?? 0,
        }))
            .map((slot) => ({ ...slot, available: slot.slotCapacity - slot.booked }))
            .filter((slot) => slot.available > 0); // excluir cupos completos
        return { date, items };
    });
    /** Crear horario recurrente (solo ADMIN) */
    app.post('/', { preHandler: [...adminOnly, validate({ body: createScheduleSchema })] }, async (request, reply) => {
        const data = request.body;
        // El doctor debe existir, estar activo y tener la especialidad asignada
        const doctor = await prisma.doctor.findFirst({
            where: { id: data.doctorId, deletedAt: null },
        });
        if (!doctor || doctor.status !== 'ACTIVE') {
            throw new AppError('VALIDATION_ERROR', 'El doctor indicado no existe o no está activo');
        }
        const assignment = await prisma.doctorSpecialty.findFirst({
            where: { doctorId: data.doctorId, specialtyId: data.specialtyId, status: 'ACTIVE', deletedAt: null },
        });
        if (!assignment) {
            throw new AppError('VALIDATION_ERROR', 'El doctor no tiene asignada esa especialidad; asígnela primero');
        }
        const existing = await loadDoctorSchedules(data.doctorId);
        if (findConflictingSchedule(data, existing)) {
            throw new AppError('CONFLICT', 'El horario se superpone con otro existente del doctor');
        }
        const schedule = await prisma.schedule.create({ data });
        reply.status(201);
        return schedule;
    });
    /** Listado de horarios con filtros (autenticado) */
    app.get('/', { preHandler: [authenticate, validate({ query: schedulesQuerySchema })] }, async (request) => {
        const params = parseOffsetQuery(request.query);
        const filters = request.query;
        const where = {
            deletedAt: null,
            ...(filters.doctorId ? { doctorId: filters.doctorId } : {}),
            ...(filters.specialtyId ? { specialtyId: filters.specialtyId } : {}),
            ...(filters.status ? { status: filters.status } : {}),
        };
        const [items, total] = await Promise.all([
            prisma.schedule.findMany({
                where,
                orderBy: [{ startTime: 'asc' }],
                skip: params.skip,
                take: params.take,
                include: {
                    doctor: {
                        include: {
                            employee: {
                                include: {
                                    user: { select: { person: { select: { firstName: true, lastName: true } } } },
                                },
                            },
                        },
                    },
                    specialty: { select: { name: true } },
                },
            }),
            prisma.schedule.count({ where }),
        ]);
        return buildOffsetPage(items.map((s) => ({
            id: s.id,
            doctorName: `${s.doctor.employee.user.person.firstName} ${s.doctor.employee.user.person.lastName}`,
            specialtyName: s.specialty.name,
            daysBitmask: s.daysBitmask,
            startTime: s.startTime,
            endTime: s.endTime,
            slotCapacity: s.slotCapacity,
            status: s.status,
        })), total, params);
    });
    /** Modificar horario (solo ADMIN); revalida solapamientos excluyéndose */
    app.patch('/:id', { preHandler: [...adminOnly, validate({ params: scheduleIdParamSchema }), validate({ body: updateScheduleSchema })] }, async (request) => {
        const { id } = request.params;
        const updates = request.body;
        const schedule = await prisma.schedule.findFirst({ where: { id, deletedAt: null } });
        if (!schedule)
            throw new AppError('NOT_FOUND', 'Horario no encontrado');
        const merged = {
            doctorId: schedule.doctorId,
            specialtyId: schedule.specialtyId,
            daysBitmask: updates.daysBitmask ?? schedule.daysBitmask,
            startTime: updates.startTime ?? schedule.startTime,
            endTime: updates.endTime ?? schedule.endTime,
            slotCapacity: updates.slotCapacity ?? schedule.slotCapacity,
        };
        const existing = await loadDoctorSchedules(schedule.doctorId);
        if (findConflictingSchedule(merged, existing, id)) {
            throw new AppError('CONFLICT', 'El horario modificado se superpone con otro existente');
        }
        const updated = await prisma.schedule.update({ where: { id }, data: updates });
        return updated;
    });
    /** Eliminar horario (soft delete; las citas ya creadas se preservan) */
    app.delete('/:id', { preHandler: [...adminOnly, validate({ params: scheduleIdParamSchema })] }, async (request, reply) => {
        const { id } = request.params;
        const schedule = await prisma.schedule.findFirst({ where: { id, deletedAt: null } });
        if (!schedule)
            throw new AppError('NOT_FOUND', 'Horario no encontrado');
        await prisma.schedule.update({ where: { id }, data: { deletedAt: new Date() } });
        reply.status(204);
        return null;
    });
}
//# sourceMappingURL=schedule.routes.js.map