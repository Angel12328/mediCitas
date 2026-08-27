import { authenticate, requireRoles } from '../../shared/auth/guards.js';
import { AppError } from '../../shared/errors/app-error.js';
import { prisma } from '../../shared/database/client.js';
import { buildOffsetPage, parseOffsetQuery } from '../../shared/pagination/pagination.js';
import { cargoIdParamSchema, createCargoSchema, updateCargoSchema, } from './employee.schemas.js';
import { validate } from '../../shared/validation/validate.js';
function isUniqueViolation(error) {
    return (typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002');
}
export async function cargoRoutes(app) {
    /** Catálogo de cargos (autenticado); ?status=ACTIVE filtra activos */
    app.get('/', { preHandler: [authenticate] }, async (request) => {
        const params = parseOffsetQuery(request.query);
        const query = request.query;
        const where = {
            deletedAt: null,
            ...(query.status ? { status: query.status } : {}),
        };
        const [items, total] = await Promise.all([
            prisma.cargo.findMany({
                where,
                orderBy: { name: 'asc' },
                skip: params.skip,
                take: params.take,
            }),
            prisma.cargo.count({ where }),
        ]);
        return buildOffsetPage(items, total, params);
    });
    /** Crear cargo (solo ADMIN) */
    app.post('/', { preHandler: [authenticate, requireRoles('ADMIN'), validate({ body: createCargoSchema })] }, async (request, reply) => {
        const { name } = request.body;
        try {
            const cargo = await prisma.cargo.create({ data: { name } });
            reply.status(201);
            return cargo;
        }
        catch (error) {
            if (isUniqueViolation(error)) {
                throw new AppError('CONFLICT', 'Ya existe un cargo con ese nombre');
            }
            throw error;
        }
    });
    /** Actualizar cargo: renombrar o activar/desactivar (solo ADMIN) */
    app.patch('/:id', { preHandler: [authenticate, requireRoles('ADMIN'), validate({ params: cargoIdParamSchema }), validate({ body: updateCargoSchema })] }, async (request) => {
        const { id } = request.params;
        const updates = request.body;
        const existing = await prisma.cargo.findFirst({ where: { id, deletedAt: null } });
        if (!existing) {
            throw new AppError('NOT_FOUND', 'Cargo no encontrado');
        }
        try {
            return await prisma.cargo.update({ where: { id }, data: updates });
        }
        catch (error) {
            if (isUniqueViolation(error)) {
                throw new AppError('CONFLICT', 'Ya existe un cargo con ese nombre');
            }
            throw error;
        }
    });
}
//# sourceMappingURL=cargo.routes.js.map