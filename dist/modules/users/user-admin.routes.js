import { authenticate, requireRoles } from '../../shared/auth/guards.js';
import { AppError } from '../../shared/errors/app-error.js';
import { prisma } from '../../shared/database/client.js';
import { buildOffsetPage, parseOffsetQuery } from '../../shared/pagination/pagination.js';
import { assignRoleSchema, createAdminUserSchema, createRoleSchema, updateRoleSchema, updateUserStatusSchema, userIdParamSchema, userListQuerySchema, userRoleParamsSchema, } from './user.schemas.js';
import { createUserByAdmin, setUserStatus } from './user-admin.service.js';
import { validate } from '../../shared/validation/validate.js';
const adminOnly = [authenticate, requireRoles('ADMIN')];
function isUniqueViolation(error) {
    return (typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002');
}
async function requireActiveUser(userId) {
    const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) {
        throw new AppError('VALIDATION_ERROR', 'El usuario indicado no existe');
    }
}
export async function userAdminRoutes(app) {
    // ==================== ROLES ====================
    /** Catálogo de roles con estado (solo ADMIN) */
    app.get('/roles', { preHandler: adminOnly }, async () => {
        const roles = await prisma.role.findMany({
            where: { deletedAt: null },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, description: true, status: true },
        });
        return { items: roles, total: roles.length };
    });
    /** Crear rol (solo ADMIN) */
    app.post('/roles', { preHandler: [...adminOnly, validate({ body: createRoleSchema })] }, async (request, reply) => {
        const { name, description } = request.body;
        try {
            const role = await prisma.role.create({ data: { name, description } });
            reply.status(201);
            return role;
        }
        catch (error) {
            if (isUniqueViolation(error)) {
                throw new AppError('CONFLICT', 'Ya existe un rol con ese nombre');
            }
            throw error;
        }
    });
    /** Actualizar rol: renombrar, describir, activar/desactivar (solo ADMIN) */
    app.patch('/roles/:id', { preHandler: [...adminOnly, validate({ body: updateRoleSchema })] }, async (request) => {
        const { id } = request.params;
        const updates = request.body;
        const existing = await prisma.role.findFirst({ where: { id, deletedAt: null } });
        if (!existing) {
            throw new AppError('NOT_FOUND', 'Rol no encontrado');
        }
        try {
            return await prisma.role.update({
                where: { id },
                data: updates,
                select: { id: true, name: true, description: true, status: true },
            });
        }
        catch (error) {
            if (isUniqueViolation(error)) {
                throw new AppError('CONFLICT', 'Ya existe un rol con ese nombre');
            }
            throw error;
        }
    });
    // ==================== USUARIOS ====================
    /** Listado de usuarios con filtros email/estado/rol y paginación (solo ADMIN) */
    app.get('/users', { preHandler: [...adminOnly, validate({ query: userListQuerySchema })] }, async (request) => {
        const params = parseOffsetQuery(request.query);
        const filters = request.query;
        const where = {
            deletedAt: null,
            ...(filters.email ? { email: { contains: filters.email.toLowerCase() } } : {}),
            ...(filters.status ? { status: filters.status } : {}),
            ...(filters.role
                ? {
                    roles: {
                        some: {
                            deletedAt: null,
                            status: 'ACTIVE',
                            role: { name: filters.role },
                        },
                    },
                }
                : {}),
        };
        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: params.skip,
                take: params.take,
                include: {
                    person: { select: { firstName: true, lastName: true } },
                    roles: {
                        where: { deletedAt: null, status: 'ACTIVE' },
                        select: { role: { select: { name: true } } },
                    },
                },
            }),
            prisma.user.count({ where }),
        ]);
        const items = users.map((u) => ({
            id: u.id,
            email: u.email,
            status: u.status,
            createdAt: u.createdAt,
            fullName: `${u.person.firstName} ${u.person.lastName}`,
            roles: u.roles.map((r) => r.role.name),
        }));
        return buildOffsetPage(items, total, params);
    });
    /** Alta manual de cuenta con roles (solo ADMIN) */
    app.post('/users', { preHandler: [...adminOnly, validate({ body: createAdminUserSchema })] }, async (request, reply) => {
        const created = await createUserByAdmin(request.body, request.user.id);
        reply.status(201);
        return created;
    });
    /** Activar/desactivar cuenta de usuario (solo ADMIN) */
    app.patch('/users/:id/status', {
        preHandler: [
            ...adminOnly,
            validate({ params: userIdParamSchema }),
            validate({ body: updateUserStatusSchema }),
        ],
    }, async (request) => {
        const { id } = request.params;
        const { status } = request.body;
        return setUserStatus(id, status, request.user.id);
    });
    // ==================== ASIGNACIÓN USUARIO-ROL ====================
    /** Asignar rol a usuario; reactiva si estaba inactivo (solo ADMIN) */
    app.post('/users/:id/roles', {
        preHandler: [
            ...adminOnly,
            validate({ params: userIdParamSchema }),
            validate({ body: assignRoleSchema }),
        ],
    }, async (request, reply) => {
        const { id: userId } = request.params;
        const { roleId } = request.body;
        await requireActiveUser(userId);
        const role = await prisma.role.findFirst({ where: { id: roleId, deletedAt: null } });
        if (!role) {
            throw new AppError('VALIDATION_ERROR', 'El rol indicado no existe');
        }
        const existing = await prisma.userRole.findUnique({
            where: { userId_roleId: { userId, roleId } },
        });
        if (existing && existing.status === 'ACTIVE' && !existing.deletedAt) {
            throw new AppError('CONFLICT', 'El usuario ya tiene este rol activo');
        }
        // Reactivar asociación previa o crearla
        const assignment = await prisma.userRole.upsert({
            where: { userId_roleId: { userId, roleId } },
            update: { status: 'ACTIVE', deletedAt: null },
            create: { userId, roleId },
        });
        reply.status(existing ? 200 : 201);
        return {
            userId: assignment.userId,
            roleId: assignment.roleId,
            status: assignment.status,
            roleName: role.name,
        };
    });
    /** Desactivar rol de usuario (la asociación queda INACTIVA, no se borra) */
    app.delete('/users/:id/roles/:roleId', { preHandler: [...adminOnly, validate({ params: userRoleParamsSchema })] }, async (request, reply) => {
        const { id: userId, roleId } = request.params;
        const existing = await prisma.userRole.findUnique({
            where: { userId_roleId: { userId, roleId } },
        });
        if (!existing || existing.status === 'INACTIVE') {
            throw new AppError('NOT_FOUND', 'El usuario no tiene este rol activo');
        }
        await prisma.userRole.update({
            where: { userId_roleId: { userId, roleId } },
            data: { status: 'INACTIVE', deletedAt: new Date() },
        });
        reply.status(204);
        return null;
    });
}
//# sourceMappingURL=user-admin.routes.js.map