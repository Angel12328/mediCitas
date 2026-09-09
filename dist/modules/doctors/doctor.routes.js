import { authenticate, requireRoles } from '../../shared/auth/guards.js';
import { AppError } from '../../shared/errors/app-error.js';
import { prisma } from '../../shared/database/client.js';
import { buildOffsetPage, parseOffsetQuery } from '../../shared/pagination/pagination.js';
import { assignSpecialtySchema, createDoctorSchema, doctorIdParamSchema, doctorSpecialtyParamsSchema, doctorsQuerySchema, updateDoctorSchema, } from './doctor.schemas.js';
import { validate } from '../../shared/validation/validate.js';
const adminOnly = [authenticate, requireRoles('ADMIN')];
function isUniqueViolation(error) {
    return (typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002');
}
async function requireDoctor(doctorId) {
    const doctor = await prisma.doctor.findFirst({
        where: { id: doctorId, deletedAt: null },
        include: {
            employee: {
                include: {
                    user: {
                        select: {
                            email: true,
                            person: { select: { firstName: true, lastName: true } },
                        },
                    },
                },
            },
            specialties: {
                where: { status: 'ACTIVE', deletedAt: null },
                select: { specialty: { select: { id: true, name: true } } },
            },
        },
    });
    if (!doctor)
        throw new AppError('NOT_FOUND', 'Doctor no encontrado');
    return {
        id: doctor.id,
        status: doctor.status,
        fullName: `${doctor.employee.user.person.firstName} ${doctor.employee.user.person.lastName}`,
        email: doctor.employee.user.email,
        specialties: doctor.specialties.map((s) => s.specialty),
    };
}
async function calculateAvailabilitySummary(specialtyId, daysAhead) {
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + daysAhead);
    // 1. Obtener horarios activos del doctor para la especialidad
    const schedules = await prisma.schedule.findMany({
        where: {
            specialtyId,
            deletedAt: null,
            status: 'ACTIVE',
        },
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
    if (schedules.length === 0)
        return {};
    // 2. Generar todas las fechas en rango que coincidan con daysBitmask
    const scheduleDates = [];
    for (const s of schedules) {
        const current = new Date(startDate);
        while (current <= endDate) {
            const dow = current.getUTCDay(); // 0=Dom, 1=Lun...
            const bit = 1 << dow;
            if (s.daysBitmask & bit) {
                scheduleDates.push({
                    doctorId: s.doctorId,
                    scheduleId: s.id,
                    startTime: s.startTime,
                    endTime: s.endTime,
                    slotCapacity: s.slotCapacity,
                    date: new Date(current),
                });
            }
            current.setDate(current.getDate() + 1);
        }
    }
    if (scheduleDates.length === 0)
        return {};
    // 3. Obtener booked counts para todas esas fechas en una query
    const dateStrings = scheduleDates.map((sd) => sd.date.toISOString().slice(0, 10));
    const uniqueDates = [...new Set(dateStrings)];
    const bookedCounts = await prisma.appointment.groupBy({
        by: ['scheduleId', 'date'],
        where: {
            scheduleId: { in: schedules.map((s) => s.id) },
            date: { in: uniqueDates.map((d) => new Date(`${d}T00:00:00Z`)) },
            deletedAt: null,
            status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
        _count: { _all: true },
    });
    const bookedMap = new Map(bookedCounts.map((b) => [`${b.scheduleId}-${b.date.toISOString().slice(0, 10)}`, b._count._all]));
    // 4. Agregar por doctor
    const summaryByDoctor = {};
    for (const sd of scheduleDates) {
        const dateStr = sd.date.toISOString().slice(0, 10);
        const booked = bookedMap.get(`${sd.scheduleId}-${dateStr}`) ?? 0;
        const available = sd.slotCapacity - booked;
        const summary = (summaryByDoctor[sd.doctorId] ??= {
            hasAvailabilityThisWeek: false,
            hasAvailabilityThisMonth: false,
            nextAvailableDate: null,
            nextSlot: null,
            totalSlotsThisMonth: 0,
            totalAvailableThisMonth: 0,
        });
        summary.totalSlotsThisMonth += 1;
        if (available > 0) {
            summary.totalAvailableThisMonth += available;
            summary.hasAvailabilityThisMonth = true;
            const isThisWeek = sd.date <= new Date(Date.now() + 7 * 86400000);
            if (isThisWeek)
                summary.hasAvailabilityThisWeek = true;
            if (!summary.nextAvailableDate || dateStr < summary.nextAvailableDate) {
                summary.nextAvailableDate = dateStr;
                summary.nextSlot = {
                    scheduleId: sd.scheduleId,
                    startTime: sd.startTime,
                    endTime: sd.endTime,
                    available,
                    total: sd.slotCapacity,
                };
            }
        }
    }
    return summaryByDoctor;
}
export async function doctorRoutes(app) {
    /** Registrar doctor vinculado a un empleado existente (solo ADMIN) */
    app.post('/', { preHandler: [...adminOnly, validate({ body: createDoctorSchema })] }, async (request, reply) => {
        const { employeeId } = request.body;
        const employee = await prisma.employee.findFirst({
            where: { id: employeeId, deletedAt: null },
            include: {
                user: {
                    select: { email: true, person: { select: { firstName: true, lastName: true } } },
                },
            },
        });
        if (!employee) {
            throw new AppError('VALIDATION_ERROR', 'El empleado indicado no existe');
        }
        try {
            const doctor = await prisma.doctor.create({
                data: { employeeId },
                include: { employee: { include: { user: { select: { email: true } } } } },
            });
            reply.status(201);
            return {
                id: doctor.id,
                status: doctor.status,
                employeeId: doctor.employeeId,
                email: doctor.employee.user.email,
                fullName: `${employee.user.person.firstName} ${employee.user.person.lastName}`,
            };
        }
        catch (error) {
            if (isUniqueViolation(error)) {
                throw new AppError('CONFLICT', 'Ya existe un doctor registrado para este empleado');
            }
            throw error;
        }
    });
    /** Listado de doctores con filtros estado y especialidad (público) */
    app.get('/', { preHandler: [validate({ query: doctorsQuerySchema })] }, async (request) => {
        const params = parseOffsetQuery(request.query);
        const filters = request.query;
        const where = {
            deletedAt: null,
            ...(filters.status ? { status: filters.status } : {}),
            ...(filters.specialtyId
                ? {
                    specialties: {
                        some: {
                            specialtyId: filters.specialtyId,
                            status: 'ACTIVE',
                            deletedAt: null,
                        },
                    },
                }
                : {}),
        };
        const specialtyId = filters.specialtyId;
        const withAvailability = filters.withAvailability ?? false;
        const daysAhead = filters.daysAhead ?? 30;
        const sort = filters.sort;
        const filter = filters.filter;
        // Si no se pide disponibilidad, usar query simple existente
        if (!withAvailability || !specialtyId) {
            const [doctors, total] = await Promise.all([
                prisma.doctor.findMany({
                    where,
                    orderBy: { createdAt: 'desc' },
                    skip: params.skip,
                    take: params.take,
                    include: {
                        employee: {
                            include: {
                                user: {
                                    select: {
                                        email: true,
                                        person: { select: { firstName: true, lastName: true } },
                                    },
                                },
                            },
                        },
                        specialties: {
                            where: { status: 'ACTIVE', deletedAt: null },
                            select: { specialty: { select: { id: true, name: true } } },
                        },
                    },
                }),
                prisma.doctor.count({ where }),
            ]);
            const items = doctors.map((d) => ({
                id: d.id,
                fullName: `${d.employee.user.person.firstName} ${d.employee.user.person.lastName}`,
                email: d.employee.user.email,
                specialties: d.specialties.map((s) => s.specialty.name),
                status: d.status,
            }));
            return buildOffsetPage(items, total, params);
        }
        // Con disponibilidad: query optimizada con CTE
        const availabilitySummary = await calculateAvailabilitySummary(specialtyId, daysAhead);
        // Filtrar doctores que tienen la especialidad y están activos
        const doctorIds = Object.keys(availabilitySummary);
        const whereWithIds = {
            ...where,
            id: { in: doctorIds },
        };
        const [doctors, total] = await Promise.all([
            prisma.doctor.findMany({
                where: whereWithIds,
                orderBy: sort === 'name'
                    ? { employee: { user: { person: { firstName: 'asc' } } } }
                    : { createdAt: 'desc' },
                skip: params.skip,
                take: params.take,
                include: {
                    employee: {
                        include: {
                            user: {
                                select: {
                                    email: true,
                                    person: { select: { firstName: true, lastName: true } },
                                },
                            },
                        },
                    },
                    specialties: {
                        where: { status: 'ACTIVE', deletedAt: null },
                        select: { specialty: { select: { id: true, name: true } } },
                    },
                },
            }),
            prisma.doctor.count({ where: whereWithIds }),
        ]);
        let items = doctors.map((d) => {
            const summary = availabilitySummary[d.id] ?? {
                hasAvailabilityThisWeek: false,
                hasAvailabilityThisMonth: false,
                nextAvailableDate: null,
                nextSlot: null,
                totalSlotsThisMonth: 0,
                totalAvailableThisMonth: 0,
            };
            return {
                id: d.id,
                fullName: `${d.employee.user.person.firstName} ${d.employee.user.person.lastName}`,
                email: d.employee.user.email,
                specialties: d.specialties.map((s) => s.specialty.name),
                status: d.status,
                availabilitySummary: summary,
            };
        });
        // Aplicar filtro server-side
        if (filter === 'hasAvailabilityThisWeek') {
            items = items.filter((i) => i.availabilitySummary.hasAvailabilityThisWeek);
        }
        // Ordenamiento server-side
        if (sort === 'availability') {
            items.sort((a, b) => {
                // Prioridad: tiene esta semana > tiene este mes > sin cupo
                const aHasWeek = a.availabilitySummary.hasAvailabilityThisWeek ? 2 : 0;
                const aHasMonth = a.availabilitySummary.hasAvailabilityThisMonth ? 1 : 0;
                const bHasWeek = b.availabilitySummary.hasAvailabilityThisWeek ? 2 : 0;
                const bHasMonth = b.availabilitySummary.hasAvailabilityThisMonth ? 1 : 0;
                const aScore = aHasWeek + aHasMonth;
                const bScore = bHasWeek + bHasMonth;
                if (bScore !== aScore)
                    return bScore - aScore;
                return a.fullName.localeCompare(b.fullName);
            });
        }
        return buildOffsetPage(items, total, params);
    });
    /** Detalle del doctor con especialidades (público) */
    app.get('/:id', { preHandler: [validate({ params: doctorIdParamSchema })] }, async (request) => {
        const { id } = request.params;
        const doctor = await requireDoctor(id);
        return {
            id: doctor.id,
            fullName: doctor.fullName,
            email: doctor.email,
            specialties: doctor.specialties,
            status: doctor.status,
        };
    });
    /** Activar/desactivar doctor (solo ADMIN) */
    app.patch('/:id', {
        preHandler: [
            ...adminOnly,
            validate({ params: doctorIdParamSchema }),
            validate({ body: updateDoctorSchema }),
        ],
    }, async (request) => {
        const { id } = request.params;
        await requireDoctor(id);
        const { status } = request.body;
        const updated = await prisma.doctor.update({ where: { id }, data: { status } });
        return { id: updated.id, status: updated.status };
    });
    // ==================== DOCTOR-ESPECIALIDAD ====================
    /**
     * Asignar especialidad a doctor. Reactiva asignaciones previas;
     * CONFLICT si ya está activa.
     */
    app.post('/:id/specialties', {
        preHandler: [
            ...adminOnly,
            validate({ params: doctorIdParamSchema }),
            validate({ body: assignSpecialtySchema }),
        ],
    }, async (request, reply) => {
        const { id: doctorId } = request.params;
        await requireDoctor(doctorId);
        const { specialtyId } = request.body;
        const specialty = await prisma.specialty.findFirst({
            where: { id: specialtyId, deletedAt: null },
        });
        if (!specialty) {
            throw new AppError('VALIDATION_ERROR', 'La especialidad indicada no existe');
        }
        const existing = await prisma.doctorSpecialty.findUnique({
            where: { doctorId_specialtyId: { doctorId, specialtyId } },
        });
        if (existing && existing.status === 'ACTIVE' && !existing.deletedAt) {
            throw new AppError('CONFLICT', 'El doctor ya tiene esta especialidad activa');
        }
        const assignment = await prisma.doctorSpecialty.upsert({
            where: { doctorId_specialtyId: { doctorId, specialtyId } },
            update: { status: 'ACTIVE', deletedAt: null },
            create: { doctorId, specialtyId },
        });
        reply.status(existing ? 200 : 201);
        return {
            doctorId: assignment.doctorId,
            specialtyId: assignment.specialtyId,
            specialtyName: specialty.name,
            status: assignment.status,
        };
    });
    /** Retirar especialidad del doctor (asociación preservada como INACTIVA) */
    app.delete('/:id/specialties/:specialtyId', { preHandler: [...adminOnly, validate({ params: doctorSpecialtyParamsSchema })] }, async (request, reply) => {
        const { id: doctorId, specialtyId } = request.params;
        const existing = await prisma.doctorSpecialty.findUnique({
            where: { doctorId_specialtyId: { doctorId, specialtyId } },
        });
        if (!existing || existing.status === 'INACTIVE') {
            throw new AppError('NOT_FOUND', 'El doctor no tiene esta especialidad activa');
        }
        await prisma.doctorSpecialty.update({
            where: { doctorId_specialtyId: { doctorId, specialtyId } },
            data: { status: 'INACTIVE', deletedAt: new Date() },
        });
        reply.status(204);
        return null;
    });
}
//# sourceMappingURL=doctor.routes.js.map