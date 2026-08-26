// Rutas de empleados y asignación de cargos - mediCitas API
// Historial de cargos preservado: cada asignación es una fila con timestamp.
import type { AnyFastifyInstance } from '../../shared/fastify-types.js';
import { authenticate, requireRoles } from '../../shared/auth/guards.js';
import { AppError } from '../../shared/errors/app-error.js';
import { prisma } from '../../shared/database/client.js';
import { buildOffsetPage, parseOffsetQuery } from '../../shared/pagination/pagination.js';
import {
  assignCargoSchema,
  createEmployeeSchema,
  employeeIdParamSchema,
  employeeQuerySchema,
  updateEmployeeSchema,
} from './employee.schemas.js';
import { validate } from '../../shared/validation/validate.js';

const adminOnly = [authenticate, requireRoles('ADMIN')];

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

interface ExistingEmployee {
  id: string;
}

async function requireEmployee(employeeId: string): Promise<ExistingEmployee> {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
  });
  if (!employee) {
    throw new AppError('NOT_FOUND', 'Empleado no encontrado');
  }
  return { id: employee.id };
}

export async function employeeRoutes(app: AnyFastifyInstance): Promise<void> {
  /** Registrar empleado vinculado a un usuario existente (solo ADMIN) */
  app.post(
    '/',
    { preHandler: [...adminOnly, validate({ body: createEmployeeSchema })] },
    async (request, reply) => {
      const { userId } = request.body as { userId: string };

      const user = await prisma.user.findFirst({
        where: { id: userId, deletedAt: null },
      });
      if (!user) {
        throw new AppError('VALIDATION_ERROR', 'El usuario indicado no existe');
      }

      try {
        const employee = await prisma.employee.create({
          data: { userId },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                person: { select: { firstName: true, lastName: true } },
              },
            },
          },
        });
        reply.status(201);
        return {
          id: employee.id,
          status: employee.status,
          userId: employee.user.id,
          email: employee.user.email,
          fullName: `${employee.user.person.firstName} ${employee.user.person.lastName}`,
        };
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AppError('CONFLICT', 'Ya existe un empleado registrado para este usuario');
        }
        throw error;
      }
    }
  );

  /** Listado de empleados con filtros estado/rol (solo ADMIN) */
  app.get(
    '/',
    { preHandler: [...adminOnly, validate({ query: employeeQuerySchema })] },
    async (request) => {
      const params = parseOffsetQuery(request.query as Record<string, unknown>);
      const filters = request.query as { status?: 'ACTIVE' | 'INACTIVE'; role?: string };

      const where = {
        deletedAt: null as Date | null,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.role
          ? {
              user: {
                roles: {
                  some: {
                    status: 'ACTIVE' as const,
                    deletedAt: null,
                    role: { name: filters.role },
                  },
                },
              },
            }
          : {}),
      };

      const [employees, total] = await Promise.all([
        prisma.employee.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: params.skip,
          take: params.take,
          include: {
            user: {
              select: {
                email: true,
                person: { select: { firstName: true, lastName: true } },
                roles: {
                  where: { status: 'ACTIVE', deletedAt: null },
                  select: { role: { select: { name: true } } },
                },
              },
            },
            cargoAssign: {
              orderBy: { assignedAt: 'desc' },
              take: 1,
              include: { cargo: { select: { name: true } } },
            },
          },
        }),
        prisma.employee.count({ where }),
      ]);

      const items = employees.map((e) => ({
        id: e.id,
        email: e.user.email,
        fullName: `${e.user.person.firstName} ${e.user.person.lastName}`,
        roles: e.user.roles.map((r) => r.role.name),
        currentCargo: e.cargoAssign[0]?.cargo.name ?? null,
        status: e.status,
      }));
      return buildOffsetPage(items, total, params);
    }
  );

  /** Activar/desactivar empleado (solo ADMIN) */
  app.patch(
    '/:id',
    { preHandler: [...adminOnly, validate({ params: employeeIdParamSchema }), validate({ body: updateEmployeeSchema })] },
    async (request) => {
      const { id } = request.params as { id: string };
      await requireEmployee(id);
      const { status } = request.body as { status: 'ACTIVE' | 'INACTIVE' };

      const updated = await prisma.employee.update({
        where: { id },
        data: { status },
      });
      return { id: updated.id, status: updated.status };
    }
  );

  // ==================== ASIGNACIÓN EMPLEADO-CARGO ====================

  /**
   * Asignar cargo a empleado. El historial se preserva: cada cambio
   * crea una nueva fila con timestamp; reasignar el cargo actual → CONFLICT.
   */
  app.post(
    '/:id/cargos',
    { preHandler: [...adminOnly, validate({ params: employeeIdParamSchema }), validate({ body: assignCargoSchema })] },
    async (request, reply) => {
      const { id: employeeId } = request.params as { id: string };
      await requireEmployee(employeeId);
      const { cargoId } = request.body as { cargoId: string };

      const cargo = await prisma.cargo.findFirst({
        where: { id: cargoId, deletedAt: null },
      });
      if (!cargo) {
        throw new AppError('VALIDATION_ERROR', 'El cargo indicado no existe');
      }

      // Cargo "actual" = última asignación por fecha
      const currentAssignment = await prisma.employeeCargo.findFirst({
        where: { employeeId, deletedAt: null },
        orderBy: { assignedAt: 'desc' },
      });
      if (currentAssignment?.cargoId === cargoId) {
        throw new AppError('CONFLICT', 'El empleado ya tiene este cargo como posición actual');
      }

      const assignment = await prisma.employeeCargo.create({
        data: { employeeId, cargoId, assignedAt: new Date() },
        include: { cargo: { select: { name: true } } },
      });

      reply.status(201);
      return {
        employeeId: assignment.employeeId,
        cargoId: assignment.cargoId,
        cargoName: assignment.cargo.name,
        assignedAt: assignment.assignedAt,
      };
    }
  );

  /** Historial completo de cargos del empleado (más reciente primero) */
  app.get(
    '/:id/cargos',
    { preHandler: [...adminOnly, validate({ params: employeeIdParamSchema })] },
    async (request) => {
      const { id: employeeId } = request.params as { id: string };
      await requireEmployee(employeeId);

      const history = await prisma.employeeCargo.findMany({
        where: { employeeId, deletedAt: null },
        orderBy: { assignedAt: 'desc' },
        include: { cargo: { select: { name: true, status: true } } },
      });

      return {
        items: history.map((h) => ({
          cargoName: h.cargo.name,
          assignedAt: h.assignedAt,
        })),
        total: history.length,
      };
    }
  );
}
