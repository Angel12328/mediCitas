import { authenticate } from '../../shared/auth/guards.js';
import { AppError } from '../../shared/errors/app-error.js';
import { prisma } from '../../shared/database/client.js';
import { createPhoneSchema, phoneIdParamSchema, phonesQuerySchema, updatePhoneSchema, } from './contact.schemas.js';
import { validate } from '../../shared/validation/validate.js';
function isUniqueViolation(error) {
    return (typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002');
}
/** Verifica existencia del teléfono y que el usuario sea dueño o ADMIN */
async function authorizePhoneAccess(userId, isAdmin, phoneId) {
    const phone = await prisma.phone.findFirst({
        where: { id: phoneId, deletedAt: null },
        include: { person: { include: { user: { select: { id: true } } } } },
    });
    if (!phone)
        throw new AppError('NOT_FOUND', 'Teléfono no encontrado');
    const ownerId = phone.person.user?.id;
    if (!isAdmin && ownerId !== userId) {
        throw new AppError('FORBIDDEN', 'Solo puedes gestionar los teléfonos de tu propia persona');
    }
    return { id: phone.id };
}
export async function phoneRoutes(app) {
    /** Teléfonos de una persona (filtro personId requerido; dueño o ADMIN) */
    app.get('/', { preHandler: [authenticate, validate({ query: phonesQuerySchema })] }, async (request) => {
        const { personId } = request.query;
        const user = request.user;
        const person = await prisma.person.findFirst({
            where: { id: personId, deletedAt: null },
            include: { user: { select: { id: true } } },
        });
        if (!person)
            throw new AppError('NOT_FOUND', 'Persona no encontrada');
        if (!user.roles.includes('ADMIN') && person.user?.id !== user.id) {
            throw new AppError('FORBIDDEN', 'Solo puedes consultar tus propios teléfonos');
        }
        const phones = await prisma.phone.findMany({
            where: { personId, deletedAt: null },
            orderBy: { createdAt: 'asc' },
            include: { extension: { select: { name: true } } },
        });
        return {
            items: phones.map((p) => ({
                id: p.id,
                number: p.number,
                extensionName: p.extension.name,
                createdAt: p.createdAt,
            })),
            total: phones.length,
        };
    });
    /** Agregar número a una persona (dueño o ADMIN) */
    app.post('/', { preHandler: [authenticate, validate({ body: createPhoneSchema })] }, async (request, reply) => {
        const user = request.user;
        const data = request.body;
        const person = await prisma.person.findFirst({
            where: { id: data.personId, deletedAt: null },
            include: { user: { select: { id: true } } },
        });
        if (!person)
            throw new AppError('VALIDATION_ERROR', 'La persona indicada no existe');
        if (!user.roles.includes('ADMIN') && person.user?.id !== user.id) {
            throw new AppError('FORBIDDEN', 'Solo puedes agregar teléfonos a tu propia persona');
        }
        const extension = await prisma.extension.findFirst({
            where: { id: data.extensionId, deletedAt: null, status: 'ACTIVE' },
        });
        if (!extension) {
            throw new AppError('VALIDATION_ERROR', 'La extensión indicada no existe o está inactiva');
        }
        try {
            const phone = await prisma.phone.create({ data });
            reply.status(201);
            return { id: phone.id, number: phone.number, extensionName: extension.name };
        }
        catch (error) {
            if (isUniqueViolation(error)) {
                throw new AppError('CONFLICT', 'Ese número ya está registrado para esta persona');
            }
            throw error;
        }
    });
    /** Modificar número/extensión (dueño o ADMIN) */
    app.patch('/:id', { preHandler: [authenticate, validate({ params: phoneIdParamSchema }), validate({ body: updatePhoneSchema })] }, async (request) => {
        const user = request.user;
        const { id } = request.params;
        const updates = request.body;
        await authorizePhoneAccess(user.id, user.roles.includes('ADMIN'), id);
        if (updates.extensionId) {
            const extension = await prisma.extension.findFirst({
                where: { id: updates.extensionId, deletedAt: null, status: 'ACTIVE' },
            });
            if (!extension) {
                throw new AppError('VALIDATION_ERROR', 'La extensión indicada no existe o está inactiva');
            }
        }
        try {
            const updated = await prisma.phone.update({
                where: { id },
                data: updates,
                include: { extension: { select: { name: true } } },
            });
            return {
                id: updated.id,
                number: updated.number,
                extensionName: updated.extension.name,
            };
        }
        catch (error) {
            if (isUniqueViolation(error)) {
                throw new AppError('CONFLICT', 'Ese número ya está registrado para esta persona');
            }
            throw error;
        }
    });
    /** Eliminar teléfono (soft delete; dueño o ADMIN) */
    app.delete('/:id', { preHandler: [authenticate, validate({ params: phoneIdParamSchema })] }, async (request, reply) => {
        const user = request.user;
        const { id } = request.params;
        await authorizePhoneAccess(user.id, user.roles.includes('ADMIN'), id);
        await prisma.phone.update({ where: { id }, data: { deletedAt: new Date() } });
        reply.status(204);
        return null;
    });
}
//# sourceMappingURL=phone.routes.js.map