// Rutas de perfil de usuario (/users/me) - mediCitas API
import { z } from 'zod';
import type { AnyFastifyInstance } from '../../shared/fastify-types.js';
import { authenticate } from '../../shared/auth/guards.js';
import { prisma } from '../../shared/database/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import { validate } from '../../shared/validation/validate.js';

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  middleName: z.string().max(50).nullable().optional(),
  lastName: z.string().min(1).max(50).optional(),
  secondLastName: z.string().max(50).nullable().optional(),
  gender: z.string().min(1).max(20).optional(),
  address: z.string().max(255).nullable().optional(),
});

export async function userProfileRoutes(app: AnyFastifyInstance): Promise<void> {
  // Todas las rutas requieren autenticación
  app.addHook('preHandler', authenticate);

  /** Perfil del usuario autenticado: usuario + persona + roles + enlace paciente/empleado */
  app.get('/me', async (request) => {
    const userId = request.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        person: true,
        patient: {
          select: {
            id: true,
            bloodType: true,
            emergencyContactName: true,
            emergencyContactNumber: true,
          },
        },
        employee: { select: { id: true } },
        roles: {
          where: { status: 'ACTIVE', deletedAt: null },
          select: { role: { select: { name: true } } },
        },
      },
    });

    if (!user || user.deletedAt) {
      throw new AppError('NOT_FOUND', 'Usuario no encontrado');
    }

    return {
      id: user.id,
      email: user.email,
      status: user.status,
      roles: user.roles.map((r) => r.role.name),
      person: {
        id: user.person.id,
        fullName: [
          user.person.firstName,
          user.person.middleName,
          user.person.lastName,
          user.person.secondLastName,
        ]
          .filter(Boolean)
          .join(' '),
        birthDate: user.person.birthDate,
        dni: user.person.dni,
        gender: user.person.gender,
        address: user.person.address,
      },
      ...(user.patient ? { patient: user.patient } : {}),
      ...(user.employee ? { employeeId: user.employee.id } : {}),
    };
  });

  /** Actualiza campos permitidos de la persona vinculada al usuario autenticado */
  app.patch('/me', { preHandler: validate({ body: updateProfileSchema }) }, async (request) => {
    const userId = request.user!.id;
    const updates = request.body as Partial<{
      firstName: string;
      middleName: string | null;
      lastName: string;
      secondLastName: string | null;
      gender: string;
      address: string | null;
    }>;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { personId: true, deletedAt: true },
    });
    if (!user || user.deletedAt) {
      throw new AppError('NOT_FOUND', 'Usuario no encontrado');
    }

    await prisma.person.update({
      where: { id: user.personId },
      data: updates,
    });

    const updated = await prisma.person.findUniqueOrThrow({
      where: { id: user.personId },
    });
    return {
      message: 'Perfil actualizado',
      person: {
        firstName: updated.firstName,
        middleName: updated.middleName,
        lastName: updated.lastName,
        secondLastName: updated.secondLastName,
        address: updated.address,
      },
    };
  });
}
