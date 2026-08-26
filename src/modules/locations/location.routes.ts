// Rutas del módulo de ubicaciones - mediCitas API
// Jerarquía: País → Departamento → Municipio
// Listados públicos (requeridos por el flujo de registro pre-login);
// creación restringida a ADMIN.
import type { AnyFastifyInstance } from '../../shared/fastify-types.js';
import { authenticate, requireRoles } from '../../shared/auth/guards.js';
import { AppError } from '../../shared/errors/app-error.js';
import { prisma } from '../../shared/database/client.js';
import { buildOffsetPage, parseOffsetQuery } from '../../shared/pagination/pagination.js';
import {
  countryQuerySchema,
  createCountrySchema,
  createDepartmentSchema,
  createMunicipalitySchema,
  departmentQuerySchema,
  idParamSchema,
  treeQuerySchema,
} from './location.schemas.js';
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

export async function locationRoutes(app: AnyFastifyInstance): Promise<void> {
  // ==================== PAÍSES ====================

  /** Catálogo público de países (paginado) */
  app.get('/countries', async (request) => {
    const params = parseOffsetQuery(request.query as Record<string, unknown>);
    const [items, total] = await Promise.all([
      prisma.country.findMany({
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
        skip: params.skip,
        take: params.take,
      }),
      prisma.country.count({ where: { deletedAt: null } }),
    ]);
    return buildOffsetPage(items, total, params);
  });

  /** Crear país (solo ADMIN) */
  app.post(
    '/countries',
    { preHandler: [...adminOnly, validate({ body: createCountrySchema })] },
    async (request, reply) => {
      const { name } = request.body as { name: string };
      try {
        const country = await prisma.country.create({ data: { name } });
        reply.status(201);
        return country;
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AppError('CONFLICT', 'Ya existe un país con ese nombre');
        }
        throw error;
      }
    }
  );

  // ==================== DEPARTAMENTOS ====================

  /** Departamentos filtrados por país (público; filtro requerido) */
  app.get(
    '/departments',
    { preHandler: validate({ query: countryQuerySchema }) },
    async (request) => {
      const { countryId } = request.query as { countryId: string };
      const params = parseOffsetQuery(request.query as Record<string, unknown>);
      const where = { countryId, deletedAt: null as Date | null };
      const [items, total] = await Promise.all([
        prisma.department.findMany({
          where,
          orderBy: { name: 'asc' },
          skip: params.skip,
          take: params.take,
          include: { _count: { select: { municipalities: true } } },
        }),
        prisma.department.count({ where }),
      ]);
      return buildOffsetPage(items, total, params);
    }
  );

  /** Crear departamento bajo un país existente (solo ADMIN) */
  app.post(
    '/departments',
    { preHandler: [...adminOnly, validate({ body: createDepartmentSchema })] },
    async (request, reply) => {
      const { name, countryId } = request.body as { name: string; countryId: string };

      const country = await prisma.country.findFirst({
        where: { id: countryId, deletedAt: null },
      });
      if (!country) {
        throw new AppError('VALIDATION_ERROR', 'El país indicado no existe');
      }

      try {
        const department = await prisma.department.create({ data: { name, countryId } });
        reply.status(201);
        return department;
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AppError('CONFLICT', 'Ya existe un departamento con ese nombre en el país');
        }
        throw error;
      }
    }
  );

  // ==================== MUNICIPIOS ====================

  /** Municipios filtrados por departamento (público; filtro requerido) */
  app.get(
    '/municipalities',
    { preHandler: validate({ query: departmentQuerySchema }) },
    async (request) => {
      const { departmentId } = request.query as { departmentId: string };
      const params = parseOffsetQuery(request.query as Record<string, unknown>);
      const where = { departmentId, deletedAt: null as Date | null };
      const [items, total] = await Promise.all([
        prisma.municipality.findMany({
          where,
          orderBy: { name: 'asc' },
          skip: params.skip,
          take: params.take,
        }),
        prisma.municipality.count({ where }),
      ]);
      return buildOffsetPage(items, total, params);
    }
  );

  /** Detalle de municipio con jerarquía completa (país + departamento) */
  app.get(
    '/municipalities/:id',
    { preHandler: validate({ params: idParamSchema }) },
    async (request) => {
      const { id } = request.params as { id: string };
      const municipality = await prisma.municipality.findFirst({
        where: { id, deletedAt: null },
        include: {
          department: {
            include: { country: true },
          },
        },
      });
      if (!municipality) {
        throw new AppError('NOT_FOUND', 'Municipio no encontrado');
      }

      return {
        id: municipality.id,
        name: municipality.name,
        department: {
          id: municipality.department.id,
          name: municipality.department.name,
        },
        country: {
          id: municipality.department.country.id,
          name: municipality.department.country.name,
        },
      };
    }
  );

  /** Crear municipio bajo un departamento existente (solo ADMIN) */
  app.post(
    '/municipalities',
    { preHandler: [...adminOnly, validate({ body: createMunicipalitySchema })] },
    async (request, reply) => {
      const { name, departmentId } = request.body as { name: string; departmentId: string };

      const department = await prisma.department.findFirst({
        where: { id: departmentId, deletedAt: null },
      });
      if (!department) {
        throw new AppError('VALIDATION_ERROR', 'El departamento indicado no existe');
      }

      try {
        const municipality = await prisma.municipality.create({
          data: { name, departmentId },
        });
        reply.status(201);
        return municipality;
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AppError(
            'CONFLICT',
            'Ya existe un municipio con ese nombre en el departamento'
          );
        }
        throw error;
      }
    }
  );

  // ==================== JERARQUÍA COMPLETA ====================

  /**
   * Árbol completo País → Departamento → Municipio.
   * Filtrable por país vía ?countryId=...
   */
  app.get('/locations/tree', { preHandler: validate({ query: treeQuerySchema }) }, async (request) => {
    const { countryId } = (request.query ?? {}) as { countryId?: string };

    const countries = await prisma.country.findMany({
      where: { deletedAt: null, ...(countryId ? { id: countryId } : {}) },
      orderBy: { name: 'asc' },
      include: {
        departments: {
          where: { deletedAt: null },
          orderBy: { name: 'asc' },
          include: {
            municipalities: {
              where: { deletedAt: null },
              orderBy: { name: 'asc' },
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    return {
      countries: countries.map((country) => ({
        id: country.id,
        name: country.name,
        departments: country.departments.map((department) => ({
          id: department.id,
          name: department.name,
          municipalities: department.municipalities.map((m) => ({ id: m.id, name: m.name })),
        })),
      })),
    };
  });
}
