// @ts-nocheck
import { authenticate } from '../../shared/auth/guards.js';
import { AppError } from '../../shared/errors/app-error.js';
import { prisma } from '../../shared/database/client.js';
import { buildOffsetPage, parseOffsetQuery } from '../../shared/pagination/pagination.js';
import { validate } from '../../shared/validation/validate.js';
import { addObservationSchema, appointmentIdParamSchema, appointmentsQuerySchema, bookAppointmentSchema, updateStatusSchema, } from './appointment.schemas.js';
import { bookAppointment, canTransition } from './appointment.service.js';
const APPOINTMENT_INCLUDE = {
    patient: {
        include: {
            user: {
                select: {
                    id: true,
                    person: { select: { firstName: true, lastName: true } },
                },
            },
        },
    },
    schedule: {
        include: {
            specialty: { select: { name: true } },
            doctor: {
                include: {
                    employee: {
                        include: {
                            user: { select: { id: true, person: { select: { firstName: true, lastName: true } } } },
                        },
                    },
                },
            },
        },
    },
};
function toDto(appointment) {
    return {
        id: appointment.id,
        date: appointment.date,
        position: appointment.position,
        status: appointment.status,
        observation: appointment.observation,
        patientId: appointment.patientId,
        patientName: `${appointment.patient.user.person.firstName} ${appointment.patient.user.person.lastName}`,
        scheduleId: appointment.scheduleId,
        startTime: appointment.schedule.startTime,
        endTime: appointment.schedule.endTime,
        specialtyName: appointment.schedule.specialty.name,
        doctorId: appointment.schedule.doctor.id,
        doctorName: `${appointment.schedule.doctor.employee.user.person.firstName} ${appointment.schedule.doctor.employee.user.person.lastName}`,
    };
}
async function loadScopedAppointment(userId, roles, appointmentId) {
    const appointment = await prisma.appointment.findFirst({
        where: { id: appointmentId, deletedAt: null },
        include: APPOINTMENT_INCLUDE,
    });
    if (!appointment)
        throw new AppError('NOT_FOUND', 'Cita no encontrada');
    const isAdmin = roles.includes('ADMIN');
    const isOwnerPatient = appointment.patient.user?.id === userId;
    const isScheduleDoctor = roles.includes('DOCTOR') && appointment.schedule.doctor.employee.user?.id === userId;
    // Alcance de lectura/acción: dueño, doctor del horario o ADMIN
    if (!isAdmin && !isOwnerPatient && !isScheduleDoctor) {
        throw new AppError('FORBIDDEN', 'No tienes acceso a esta cita');
    }
    return {
        dto: toDto(appointment),
        raw: {
            id: appointment.id,
            status: appointment.status,
            patientId: appointment.patientId,
        },
    };
}
/** Resuelve el registro de paciente del usuario autenticado (rol PATIENT) */
async function requirePatientProfile(userId) {
    const patient = await prisma.patient.findFirst({
        where: { userId, deletedAt: null },
    });
    if (!patient)
        throw new AppError('NOT_FOUND', 'Perfil de paciente no encontrado');
    return { id: patient.id };
}
/** Resuelve el doctor asociado al usuario autenticado (rol DOCTOR) */
async function requireDoctorProfile(userId) {
    const employee = await prisma.employee.findFirst({
        where: { userId, deletedAt: null },
        include: { doctor: true },
    });
    const doctor = employee?.doctor;
    if (!doctor || doctor.deletedAt) {
        throw new AppError('NOT_FOUND', 'Perfil de doctor no encontrado');
    }
    return { id: doctor.id, status: doctor.status };
}
export async function appointmentRoutes(app) {
    /** Reservar cita (paciente autenticado) con bloqueo optimista */
    app.post('/', { preHandler: [authenticate, validate({ body: bookAppointmentSchema })] }, async (request, reply) => {
        const user = request.user;
        if (!user.roles.includes('PATIENT')) {
            throw new AppError('FORBIDDEN', 'Solo los pacientes pueden reservar citas');
        }
        const profile = await requirePatientProfile(user.id);
        const { scheduleId, date } = request.body;
        const booked = await bookAppointment({ patientId: profile.id, scheduleId, date });
        reply.status(201);
        return booked;
    });
    /** Listado con alcance y filtros según rol */
    app.get('/', { preHandler: [authenticate, validate({ query: appointmentsQuerySchema })] }, async (request) => {
        const user = request.user;
        const params = parseOffsetQuery(request.query);
        const filters = request.query;
        // Restricciones de alcance por rol
        let forcedPatientId;
        let forcedDoctorId;
        if (!user.roles.includes('ADMIN') && !user.roles.includes('EMPLOYEE')) {
            if (user.roles.includes('PATIENT')) {
                const profile = await requirePatientProfile(user.id);
                forcedPatientId = profile.id;
            }
            else if (user.roles.includes('DOCTOR')) {
                const doctor = await requireDoctorProfile(user.id);
                forcedDoctorId = doctor.id;
            }
        }
        const where = {
            deletedAt: null,
            ...(forcedPatientId ? { patientId: forcedPatientId } : {}),
            ...(forcedDoctorId ? { schedule: { doctorId: forcedDoctorId } } : {}),
            ...(filters.date ? { date: new Date(`${filters.date}T00:00:00Z`) } : {}),
            ...(filters.patientId ? { patientId: filters.patientId } : {}),
            ...(filters.doctorId ? { schedule: { doctorId: filters.doctorId } } : {}),
            ...(filters.scheduleId ? { scheduleId: filters.scheduleId } : {}),
            ...(filters.status ? { status: filters.status } : {}),
        };
        const [appointments, total] = await Promise.all([
            prisma.appointment.findMany({
                where,
                orderBy: [{ date: 'asc' }, { position: 'asc' }],
                skip: params.skip,
                take: params.take,
                include: APPOINTMENT_INCLUDE,
            }),
            prisma.appointment.count({ where }),
        ]);
        return buildOffsetPage(appointments.map(toDto), total, params);
    });
    /** Transición de estado con matriz de permisos */
    app.patch('/:id/status', { preHandler: [authenticate, validate({ params: appointmentIdParamSchema }), validate({ body: updateStatusSchema })] }, async (request) => {
        const user = request.user;
        const { id } = request.params;
        const { status: nextStatus } = request.body;
        const { dto } = await loadScopedAppointment(user.id, user.roles, id);
        // El dueño es quien tiene el perfil de paciente vinculado a la cita
        const ownerPatientProfile = await prisma.patient.findFirst({
            where: { userId: user.id, deletedAt: null },
            select: { id: true },
        });
        const isOwner = dto.patientId === ownerPatientProfile?.id;
        const isStaff = user.roles.includes('ADMIN') ||
            (user.roles.includes('DOCTOR') && (await isDoctorOfSchedule(user.id, dto.doctorId)));
        if (!canTransition(dto.status, nextStatus, isOwner, isStaff)) {
            throw new AppError('CONFLICT', `Transición inválida de ${dto.status} a ${nextStatus} para tu rol`);
        }
        const updated = await prisma.appointment.update({
            where: { id },
            data: { status: nextStatus },
        });
        return { id: updated.id, status: updated.status, previousStatus: dto.status };
    });
    /** Agregar observación (se concatena preservando notas previas) */
    app.post('/:id/observations', { preHandler: [authenticate, validate({ params: appointmentIdParamSchema }), validate({ body: addObservationSchema })] }, async (request) => {
        const user = request.user;
        const { id } = request.params;
        const { observation } = request.body;
        const { dto } = await loadScopedAppointment(user.id, user.roles, id);
        const newObservation = dto.observation ? `${dto.observation}\n${observation}` : observation;
        await prisma.appointment.update({ where: { id }, data: { observation: newObservation } });
        return { id, observation: newObservation };
    });
}
// ==================== HELPERS DE PERMISOS ====================
async function isDoctorOfSchedule(userId, doctorId) {
    const employee = await prisma.employee.findFirst({
        where: { userId, deletedAt: null },
        include: { doctor: { select: { id: true } } },
    });
    return employee?.doctor?.id === doctorId;
}
//# sourceMappingURL=appointment.routes.js.map