import { authenticate, requireRoles } from '../../shared/auth/guards.js';
import { AppError } from '../../shared/errors/app-error.js';
import { prisma } from '../../shared/database/client.js';
import { z } from 'zod';
import { validate } from '../../shared/validation/validate.js';
const patientOnly = [authenticate, requireRoles('PATIENT')];
const updatePatientSchema = z.object({
    bloodType: z
        .enum([
        'A_POSITIVE',
        'A_NEGATIVE',
        'B_POSITIVE',
        'B_NEGATIVE',
        'AB_POSITIVE',
        'AB_NEGATIVE',
        'O_POSITIVE',
        'O_NEGATIVE',
    ])
        .optional(),
    allergies: z.string().max(500).nullable().optional(),
});
const createEmergencyContactSchema = z.object({
    emergencyContactName: z.string().min(1).max(150),
    emergencyContactNumber: z.string().min(5).max(20),
});
const updateEmergencyContactSchema = z.object({
    emergencyContactName: z.string().min(1).max(150).optional(),
    emergencyContactNumber: z.string().min(5).max(20).optional(),
});
/** Localiza el registro de paciente del usuario autenticado */
async function requirePatientProfile(userId) {
    const patient = await prisma.patient.findFirst({
        where: { userId, deletedAt: null },
        include: {
            user: {
                select: { email: true, person: { select: { firstName: true, lastName: true } } },
            },
        },
    });
    if (!patient)
        throw new AppError('NOT_FOUND', 'Perfil de paciente no encontrado');
    return {
        id: patient.id,
        bloodType: patient.bloodType,
        allergies: patient.allergies,
        emergencyContactName: patient.emergencyContactName,
        emergencyContactNumber: patient.emergencyContactNumber,
        email: patient.user.email,
        fullName: `${patient.user.person.firstName} ${patient.user.person.lastName}`,
    };
}
export async function patientProfileRoutes(app) {
    /** Perfil médico completo del paciente autenticado */
    app.get('/me', { preHandler: patientOnly }, async (request) => {
        const patient = await requirePatientProfile(request.user.id);
        return {
            id: patient.id,
            email: patient.email,
            fullName: patient.fullName,
            bloodType: patient.bloodType,
            allergies: patient.allergies,
            emergencyContact: patient.emergencyContactName || patient.emergencyContactNumber
                ? {
                    name: patient.emergencyContactName,
                    number: patient.emergencyContactNumber,
                }
                : null,
        };
    });
    /** Actualiza información médica (tipo de sangre validado contra catálogo estándar) */
    app.patch('/me', { preHandler: [...patientOnly, validate({ body: updatePatientSchema })] }, async (request) => {
        const updates = request.body;
        const existing = await requirePatientProfile(request.user.id);
        const updated = await prisma.patient.update({
            where: { id: existing.id },
            data: updates,
        });
        return {
            message: 'Perfil actualizado',
            bloodType: updated.bloodType,
            allergies: updated.allergies,
        };
    });
    // ==================== CONTACTO DE EMERGENCIA ====================
    /** Consulta el contacto de emergencia (puede ser null si no existe) */
    app.get('/me/emergency-contact', { preHandler: patientOnly }, async (request) => {
        const patient = await requirePatientProfile(request.user.id);
        if (!patient.emergencyContactName && !patient.emergencyContactNumber) {
            return { emergencyContact: null };
        }
        return {
            emergencyContact: {
                name: patient.emergencyContactName,
                number: patient.emergencyContactNumber,
            },
        };
    });
    /** Crea el contacto de emergencia; CONFLICT si ya existe uno */
    app.post('/me/emergency-contact', { preHandler: [...patientOnly, validate({ body: createEmergencyContactSchema })] }, async (request, reply) => {
        const existing = await requirePatientProfile(request.user.id);
        if (existing.emergencyContactName || existing.emergencyContactNumber) {
            throw new AppError('CONFLICT', 'Ya existe un contacto de emergencia; use PATCH para modificarlo');
        }
        const { emergencyContactName, emergencyContactNumber } = request.body;
        await prisma.patient.update({
            where: { id: existing.id },
            data: { emergencyContactName, emergencyContactNumber },
        });
        reply.status(201);
        return { name: emergencyContactName, number: emergencyContactNumber };
    });
    /** Modifica parcialmente el contacto de emergencia existente */
    app.patch('/me/emergency-contact', { preHandler: [...patientOnly, validate({ body: updateEmergencyContactSchema })] }, async (request) => {
        const existing = await requirePatientProfile(request.user.id);
        if (!existing.emergencyContactName && !existing.emergencyContactNumber) {
            throw new AppError('NOT_FOUND', 'No hay contacto de emergencia registrado; créelo con POST');
        }
        const updates = request.body;
        await prisma.patient.update({ where: { id: existing.id }, data: updates });
        const refreshed = await prisma.patient.findUniqueOrThrow({ where: { id: existing.id } });
        return {
            name: refreshed.emergencyContactName,
            number: refreshed.emergencyContactNumber,
        };
    });
}
//# sourceMappingURL=patient.routes.js.map