import { authenticate, requireRoles } from '../../shared/auth/guards.js';
import { AppError } from '../../shared/errors/app-error.js';
import { prisma } from '../../shared/database/client.js';
import { createExtensionSchema, extensionIdParamSchema, updateExtensionSchema, } from './contact.schemas.js';
import { validate } from '../../shared/validation/validate.js';
const adminOnly = [authenticate, requireRoles('ADMIN')];
function isUniqueViolation(error) {
    return (typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002');
}
export async function extensionRoutes(app) {
    /** Catálogo de extensiones con filtro ?status= */
    app.get('/', { preHandler: [authenticate] }, async (request) => {
        const query = request.query;
        const extensions = await prisma.extension.findMany({
            where: { deletedAt: null, ...(query.status ? { status: query.status } : {}) },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, status: true },
        });
        return { items: extensions, total: extensions.length };
    });
    /** Crear extensión (solo ADMIN) */
    app.post('/', { preHandler: [...adminOnly, validate({ body: createExtensionSchema })] }, async (request, reply) => {
        const { name } = request.body;
        try {
            const extension = await prisma.extension.create({ data: { name } });
            reply.status(201);
            return extension;
        }
        catch (error) {
            if (isUniqueViolation(error)) {
                throw new AppError('CONFLICT', 'Ya existe una extensión con ese nombre');
            }
            throw error;
        }
    });
    /** Actualizar extensión (solo ADMIN) */
    app.patch('/:id', { preHandler: [...adminOnly, validate({ params: extensionIdParamSchema }), validate({ body: updateExtensionSchema })] }, async (request) => {
        const { id } = request.params;
        const updates = request.body;
        const existing = await prisma.extension.findFirst({ where: { id, deletedAt: null } });
        if (!existing) {
            throw new AppError('NOT_FOUND', 'Extensión no encontrada');
        }
        try {
            return await prisma.extension.update({
                where: { id },
                data: updates,
                select: { id: true, name: true, status: true },
            });
        }
        catch (error) {
            if (isUniqueViolation(error)) {
                throw new AppError('CONFLICT', 'Ya existe una extensión con ese nombre');
            }
            throw error;
        }
    });
}
//# sourceMappingURL=extension.routes.js.map