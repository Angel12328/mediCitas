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
import { Prisma } from '../../generated/prisma/client.js';

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

interface AvailabilitySummary {
  hasAvailabilityThisWeek: boolean;
  hasAvailabilityThisMonth: boolean;
  nextAvailableDate: string | null;
  nextSlot: {
    scheduleId: string;
    startTime: string;
    endTime: string;
    available: number;
    total: number;
  } | null;
  totalSlotsThisMonth: number;
  totalAvailableThisMonth: number;
}

async function calculateAvailabilitySummary(
  specialtyId: string,
  daysAhead: number,
): Promise<Record<string, AvailabilitySummary>> {
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + daysAhead);

  const startDateStr = startDate.toISOString().slice(0, 10);
  const endDateStr = endDate.toISOString().slice(0, 10);

  // Query raw SQL para calcular disponibilidad agregada por doctor
  // Usa generate_series para expandir horarios a días y LEFT JOIN con appointments
  // Nota: Prisma.sql usa parameter binding, así que pasamos las fechas como strings
  // y PostgreSQL hace cast implícito a DATE al comparar con columnas DATE
  const results = await prisma.$queryRaw<
    Array<{
      doctor_id: string;
      schedule_id: string;
      start_time: string;
      end_time: string;
      slot_capacity: number;
      days_bitmask: number;
      date: Date;
      booked: bigint;
    }>
  >(Prisma.sql`
    WITH doctor_schedules AS (
      SELECT s.id AS schedule_id, s.doctor_id, s.specialty_id, s.days_bitmask,
             s.start_time, s.end_time, s.slot_capacity
      FROM schedules s
      WHERE s.specialty_id = ${specialtyId}
        AND s.deleted_at IS NULL
        AND s.status = 'ACTIVE'
    ),
    date_series AS (
      SELECT generate_series(
        ${startDateStr},
        ${endDateStr},
        interval '1 day'
      )::date AS date
    ),
    schedule_dates AS (
      SELECT ds.date, ds_schedule.*
      FROM date_series ds
      CROSS JOIN doctor_schedules ds_schedule
      WHERE ds_schedule.days_bitmask & (1 << EXTRACT(DOW FROM ds.date)::int) > 0
    ),
    booked_counts AS (
      SELECT a.schedule_id, a.date, COUNT(*) AS booked
      FROM appointments a
      WHERE a.deleted_at IS NULL
        AND a.status NOT IN ('CANCELLED', 'NO_SHOW')
        AND a.date BETWEEN ${startDateStr} AND ${endDateStr}
      GROUP BY a.schedule_id, a.date
    ),
    availability AS (
      SELECT sd.doctor_id, sd.schedule_id, sd.start_time, sd.end_time,
             sd.slot_capacity, sd.date,
             COALESCE(bc.booked, 0) AS booked
      FROM schedule_dates sd
      LEFT JOIN booked_counts bc
        ON bc.schedule_id = sd.schedule_id AND bc.date = sd.date
    )
    SELECT doctor_id, schedule_id, start_time, end_time, slot_capacity,
           days_bitmask, date, booked
    FROM availability a
    JOIN doctor_schedules ds ON ds.id = a.schedule_id
    ORDER BY doctor_id, date, start_time
  `);

  // Agregar resultados por doctor
  const summaryByDoctor: Record<string, AvailabilitySummary> = {};

  for (const row of results) {
    const doctorId = row.doctor_id;
    if (!summaryByDoctor[doctorId]) {
      summaryByDoctor[doctorId] = {
        hasAvailabilityThisWeek: false,
        hasAvailabilityThisMonth: false,
        nextAvailableDate: null,
        nextSlot: null,
        totalSlotsThisMonth: 0,
        totalAvailableThisMonth: 0,
      };
    }
    const summary = summaryByDoctor[doctorId];

    const available = Number(row.slot_capacity) - Number(row.booked);
    const dateStr = row.date.toISOString().slice(0, 10);
    const isThisWeek = new Date(row.date) <= new Date(Date.now() + 7 * 86400000);

    summary.totalSlotsThisMonth += 1;
    if (available > 0) {
      summary.totalAvailableThisMonth += available;
      summary.hasAvailabilityThisMonth = true;
      if (isThisWeek) summary.hasAvailabilityThisWeek = true;

      if (!summary.nextAvailableDate || dateStr < summary.nextAvailableDate) {
        summary.nextAvailableDate = dateStr;
        summary.nextSlot = {
          scheduleId: row.schedule_id,
          startTime: row.start_time,
          endTime: row.end_time,
          available,
          total: Number(row.slot_capacity),
        };
      }
    }
  }

  return summaryByDoctor;
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
    },
  );

  /** Listado de doctores con filtros estado y especialidad (público) */
  app.get('/', { preHandler: [validate({ query: doctorsQuerySchema })] }, async (request) => {
    const params = parseOffsetQuery(request.query as Record<string, unknown>);
    const filters = request.query as {
      status?: 'ACTIVE' | 'INACTIVE';
      specialtyId?: string;
      withAvailability?: boolean;
      daysAhead?: number;
      sort?: 'availability' | 'name' | 'createdAt';
      filter?: 'hasAvailabilityThisWeek';
    };

    const where = {
      deletedAt: null as Date | null,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.specialtyId
        ? {
            specialties: {
              some: {
                specialtyId: filters.specialtyId,
                status: 'ACTIVE' as const,
                deletedAt: null,
              },
            },
          }
        : {}),
    };

    const specialtyId = filters.specialtyId;
    const withAvailability = filters.withAvailability ?? false;
    const daysAhead = filters.daysAhead ?? 30;
    const sort = filters.sort;
    const filter = filters.filter;

    // Si no se pide disponibilidad, usar query simple existente
    if (!withAvailability || !specialtyId) {
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
    }

    // Con disponibilidad: query optimizada con CTE
    const availabilitySummary = await calculateAvailabilitySummary(specialtyId, daysAhead);

    // Filtrar doctores que tienen la especialidad y están activos
    const doctorIds = Object.keys(availabilitySummary);
    const whereWithIds = {
      ...where,
      id: { in: doctorIds },
    };

    const [doctors, total] = await Promise.all([
      prisma.doctor.findMany({
        where: whereWithIds,
        orderBy:
          sort === 'name'
            ? { employee: { user: { person: { firstName: 'asc' } } } }
            : { createdAt: 'desc' },
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
      prisma.doctor.count({ where: whereWithIds }),
    ]);

    let items = doctors.map((d) => {
      const summary = availabilitySummary[d.id] ?? {
        hasAvailabilityThisWeek: false,
        hasAvailabilityThisMonth: false,
        nextAvailableDate: null,
        nextSlot: null,
        totalSlotsThisMonth: 0,
        totalAvailableThisMonth: 0,
      };
      return {
        id: d.id,
        fullName: `${d.employee.user.person.firstName} ${d.employee.user.person.lastName}`,
        email: d.employee.user.email,
        specialties: d.specialties.map((s) => s.specialty.name),
        status: d.status,
        availabilitySummary: summary,
      };
    });

    // Aplicar filtro server-side
    if (filter === 'hasAvailabilityThisWeek') {
      items = items.filter((i) => i.availabilitySummary.hasAvailabilityThisWeek);
    }

    // Ordenamiento server-side
    if (sort === 'availability') {
      items.sort((a, b) => {
        // Prioridad: tiene esta semana > tiene este mes > sin cupo
        const aHasWeek = a.availabilitySummary.hasAvailabilityThisWeek ? 2 : 0;
        const aHasMonth = a.availabilitySummary.hasAvailabilityThisMonth ? 1 : 0;
        const bHasWeek = b.availabilitySummary.hasAvailabilityThisWeek ? 2 : 0;
        const bHasMonth = b.availabilitySummary.hasAvailabilityThisMonth ? 1 : 0;
        const aScore = aHasWeek + aHasMonth;
        const bScore = bHasWeek + bHasMonth;
        if (bScore !== aScore) return bScore - aScore;
        return a.fullName.localeCompare(b.fullName);
      });
    }

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
    {
      preHandler: [
        ...adminOnly,
        validate({ params: doctorIdParamSchema }),
        validate({ body: updateDoctorSchema }),
      ],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      await requireDoctor(id);
      const { status } = request.body as { status: 'ACTIVE' | 'INACTIVE' };
      const updated = await prisma.doctor.update({ where: { id }, data: { status } });
      return { id: updated.id, status: updated.status };
    },
  );

  // ==================== DOCTOR-ESPECIALIDAD ====================

  /**
   * Asignar especialidad a doctor. Reactiva asignaciones previas;
   * CONFLICT si ya está activa.
   */
  app.post(
    '/:id/specialties',
    {
      preHandler: [
        ...adminOnly,
        validate({ params: doctorIdParamSchema }),
        validate({ body: assignSpecialtySchema }),
      ],
    },
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
    },
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
    },
  );
}
