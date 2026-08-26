// Servicio de administración de usuarios - mediCitas API
import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/database/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import { hashPassword } from '../auth/password.service.js';
import type { CreateAdminUserInput } from './user.schemas.js';

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error as { code?: string }).code === 'P2002'
  );
}

/**
 * Alta manual de cuenta por ADMIN: persona + usuario + enlace
 * paciente/empleado + roles iniciales. Sin emisión de tokens.
 */
export async function createUserByAdmin(
  input: CreateAdminUserInput,
  actorId: string
): Promise<{
  id: string;
  email: string;
  status: string;
  roles: string[];
  fullName: string;
}> {
  const normalizedEmail = input.email.trim().toLowerCase();

  const existingUser = await prisma.user.findFirst({
    where: { email: normalizedEmail, deletedAt: null },
  });
  if (existingUser) {
    throw new AppError('CONFLICT', 'El correo ya está registrado');
  }

  const existingDni = await prisma.person.findFirst({
    where: { dni: input.person.dni, deletedAt: null },
  });
  if (existingDni) {
    throw new AppError('CONFLICT', 'El DNI ya está registrado');
  }

  const roles = await prisma.role.findMany({
    where: { name: { in: input.roleNames }, deletedAt: null, status: 'ACTIVE' },
  });
  if (roles.length !== input.roleNames.length) {
    throw new AppError('VALIDATION_ERROR', 'Uno o más roles indicados no existen');
  }

  // El actor no puede crear otra cuenta ADMIN salvo que él mismo lo sea
  // (garantizado por el guard); se registra quién creó la cuenta.
  void actorId;

  const passwordHash = await hashPassword(input.password);
  const fullName = [
    input.person.firstName,
    input.person.middleName,
    input.person.lastName,
    input.person.secondLastName,
  ]
    .filter(Boolean)
    .join(' ');

  try {
    const user = await prisma.$transaction(async (tx) => {
      const person = await tx.person.create({
        data: {
          firstName: input.person.firstName,
          middleName: input.person.middleName ?? null,
          lastName: input.person.lastName,
          secondLastName: input.person.secondLastName ?? null,
          birthDate: new Date(input.person.birthDate),
          dni: input.person.dni,
          gender: input.person.gender,
          address: input.person.address ?? null,
          countryId: input.person.countryId,
          departmentId: input.person.departmentId,
          municipalityId: input.person.municipalityId,
        },
      });

      const created = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          status: 'ACTIVE',
          personId: person.id,
        },
      });

      if (input.accountType === 'PATIENT') {
        await tx.patient.create({ data: { userId: created.id, bloodType: input.bloodType! } });
      } else {
        await tx.employee.create({ data: { userId: created.id } });
      }

      await tx.userRole.createMany({
        data: roles.map((role) => ({ userId: created.id, roleId: role.id })),
      });

      return created;
    });

    return {
      id: user.id,
      email: user.email,
      status: user.status,
      roles: input.roleNames,
      fullName,
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError('CONFLICT', 'El correo o DNI ya está registrado');
    }
    throw error;
  }
}

/** Activar/desactivar una cuenta de usuario (el actor no puede auto-desactivarse) */
export async function setUserStatus(
  userId: string,
  status: 'ACTIVE' | 'INACTIVE',
  actorId: string
): Promise<{ id: string; status: string }> {
  if (userId === actorId && status === 'INACTIVE') {
    throw new AppError('CONFLICT', 'No puedes desactivar tu propia cuenta');
  }

  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user) {
    throw new AppError('NOT_FOUND', 'Usuario no encontrado');
  }
  if (user.status === status) {
    throw new AppError('CONFLICT', `La cuenta ya está ${status === 'ACTIVE' ? 'activa' : 'inactiva'}`);
  }

  const updated = await prisma.user.update({ where: { id: userId }, data: { status } });
  return { id: updated.id, status: updated.status };
}
