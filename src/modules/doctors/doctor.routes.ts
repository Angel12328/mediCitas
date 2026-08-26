// Rutas de doctores y asignación de especialidades - mediCitas API
import type { AnyFastifyInstance } from '../../shared/fastify-types.js';
import { authenticate, requireRoles } from '../../shared/auth/guards.js';
import { AppError } from '../../shared/errors/app-error.js';
import { prisma } from '../../shared/database/client.js';
import { buildOffsetPage, parseOffsetQuery } from '../../shared/pagination/pagination.js';
import {
  assignSpecialtySchema,
  createDoctorSchema,
  doctorIdParamSchema,
  doctorSpecialtyParamsSchema,
  doctorsQuerySchema,
  updateDoctorSchema,
} from './doctor.schemas.js';
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

interface DoctorDetail {
  id: string;
  status: 'ACTIVE' | 'INACTIVE';
  fullName: string;
  email: string;
  specialties: Array<{ id: string; name: string }>;
}

async function requireDoctor(doctorId: string): Promise<DoctorDetail> {
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
  if (!doctor) throw new AppError('NOT_FOUND', 'Doctor no encontrado');
  return {
    id: doctor.id,
    status: doctor.status,
    fullName: `${doctor.employee.user.person.firstName} ${doctor.employee.user.person.lastName}`,
    email: doctor.employee.user.email,
    specialties: doctor.specialties.map((s) => s.specialty),
  };
}

export async function doctorRoutes(app: AnyFastifyInstance): Promise<void> {
  /** Registrar doctor vinculado a un empleado existente (solo ADMIN) */
  app.post(
    '/',
    { preHandler: [...adminOnly, validate({ body: createDoctorSchema })] },
    async (request, reply) => {
      const { employeeId } = request.body as { employeeId: string };

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
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AppError('CONFLICT', 'Ya existe un doctor registrado para este empleado');
        }
        throw error;
      }
    }
  );

  /** Listado de doctores con filtros estado y especialidad (público) */
  app.get('/', { preHandler: [validate({ query: doctorsQuerySchema })] }, async (request) => {
    const params = parseOffsetQuery(request.query as Record<string, unknown>);
    const filters = request.query as { status?: 'ACTIVE' | 'INACTIVE'; specialtyId?: string };

    const where = {
      deletedAt: null as Date | null,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.specialtyId
        ? {
            specialties: {
              some: { specialtyId: filters.specialtyId, status: 'ACTIVE' as const, deletedAt: null },
            },
          }
        : {}),
    };

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
  });

  /** Detalle del doctor con especialidades (público) */
  app.get('/:id', { preHandler: [validate({ params: doctorIdParamSchema })] }, async (request) => {
    const { id } = request.params as { id: string };
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
  app.patch(
    '/:id',
    { preHandler: [...adminOnly, validate({ params: doctorIdParamSchema }), validate({ body: updateDoctorSchema })] },
    async (request) => {
      const { id } = request.params as { id: string };
      await requireDoctor(id);
      const { status } = request.body as { status: 'ACTIVE' | 'INACTIVE' };
      const updated = await prisma.doctor.update({ where: { id }, data: { status } });
      return { id: updated.id, status: updated.status };
    }
  );

  // ==================== DOCTOR-ESPECIALIDAD ====================

  /**
   * Asignar especialidad a doctor. Reactiva asignaciones previas;
   * CONFLICT si ya está activa.
   */
  app.post(
    '/:id/specialties',
    { preHandler: [...adminOnly, validate({ params: doctorIdParamSchema }), validate({ body: assignSpecialtySchema })] },
    async (request, reply) => {
      const { id: doctorId } = request.params as { id: string };
      await requireDoctor(doctorId);
      const { specialtyId } = request.body as { specialtyId: string };

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
    }
  );

  /** Retirar especialidad del doctor (asociación preservada como INACTIVA) */
  app.delete(
    '/:id/specialties/:specialtyId',
    { preHandler: [...adminOnly, validate({ params: doctorSpecialtyParamsSchema })] },
    async (request, reply) => {
      const { id: doctorId, specialtyId } = request.params as {
        id: string;
        specialtyId: string;
      };

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
    }
  );
}
