import { authenticate, requireRoles } from '../../shared/auth/guards.js';
import { AppError } from '../../shared/errors/app-error.js';
import { prisma } from '../../shared/database/client.js';
import { createSpecialtySchema, specialtyIdParamSchema, updateSpecialtySchema, } from './doctor.schemas.js';
import { validate } from '../../shared/validation/validate.js';
const adminOnly = [authenticate, requireRoles('ADMIN')];
function isUniqueViolation(error) {
    return (typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002');
}
export async function specialtyRoutes(app) {
    /** Catálogo de especialidades; ?status=ACTIVE filtra disponibles para agendar */
    app.get('/', { preHandler: [authenticate] }, async (request) => {
        const query = request.query;
        const specialties = await prisma.specialty.findMany({
            where: { deletedAt: null, ...(query.status ? { status: query.status } : {}) },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, status: true },
        });
        return { items: specialties, total: specialties.length };
    });
    /** Crear especialidad (solo ADMIN) */
    app.post('/', { preHandler: [...adminOnly, validate({ body: createSpecialtySchema })] }, async (request, reply) => {
        const { name } = request.body;
        try {
            const specialty = await prisma.specialty.create({ data: { name } });
            reply.status(201);
            return specialty;
        }
        catch (error) {
            if (isUniqueViolation(error)) {
                throw new AppError('CONFLICT', 'Ya existe una especialidad con ese nombre');
            }
            throw error;
        }
    });
    /** Actualizar especialidad: renombrar o activar/desactivar (solo ADMIN) */
    app.patch('/:id', {
        preHandler: [
            ...adminOnly,
            validate({ params: specialtyIdParamSchema }),
            validate({ body: updateSpecialtySchema }),
        ],
    }, async (request) => {
        const { id } = request.params;
        const updates = request.body;
        const existing = await prisma.specialty.findFirst({ where: { id, deletedAt: null } });
        if (!existing) {
            throw new AppError('NOT_FOUND', 'Especialidad no encontrada');
        }
        try {
            return await prisma.specialty.update({
                where: { id },
                data: updates,
                select: { id: true, name: true, status: true },
            });
        }
        catch (error) {
            if (isUniqueViolation(error)) {
                throw new AppError('CONFLICT', 'Ya existe una especialidad con ese nombre');
            }
            throw error;
        }
    });
}
//# sourceMappingURL=specialty.routes.js.map