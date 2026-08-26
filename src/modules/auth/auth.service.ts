// Lógica de negocio de autenticación - mediCitas API
import { randomBytes } from 'node:crypto';
import { createHash } from 'node:crypto';
import type { User } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/database/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { Mailer } from '../../shared/mail/mailer.js';
import { hashPassword, verifyPassword } from './password.service.js';
import { issueRefreshToken, revokeAllUserSessions } from './session.service.js';
import { signAccessToken } from './token.service.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const PASSWORD_RESET_TTL_MINUTES = 60;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function getRoleNames(userId: string): Promise<string[]> {
  const assignments = await prisma.userRole.findMany({
    where: { userId, status: 'ACTIVE', role: { status: 'ACTIVE' }, deletedAt: null },
    include: { role: { select: { name: true } } },
  });
  return assignments.map((a) => a.role.name);
}

/** Emite el par de tokens (access + refresh) para un usuario autenticado. */
export async function issueTokenPair(user: Pick<User, 'id'>): Promise<AuthTokens> {
  const roles = await getRoleNames(user.id);
  const accessToken = signAccessToken({ sub: user.id, roles });
  const { refreshToken } = await issueRefreshToken(user.id);
  return { accessToken, refreshToken };
}

function mapUniqueViolation(error: unknown, message: string): never | void {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  ) {
    throw new AppError('CONFLICT', message);
  }
}

export interface RegisterInput {
  email: string;
  password: string;
  accountType: 'PATIENT' | 'EMPLOYEE';
  bloodType:
    | 'A_POSITIVE'
    | 'A_NEGATIVE'
    | 'B_POSITIVE'
    | 'B_NEGATIVE'
    | 'AB_POSITIVE'
    | 'AB_NEGATIVE'
    | 'O_POSITIVE'
    | 'O_NEGATIVE';
  person: {
    firstName: string;
    middleName?: string;
    lastName: string;
    secondLastName?: string;
    birthDate: string;
    dni: string;
    gender: string;
    address?: string;
    countryId: string;
    departmentId: string;
    municipalityId: string;
  };
}

/**
 * Registro transaccional: persona + usuario + enlace paciente/empleado
 * + asignación de rol. Auto-login (devuelve tokens).
 */
export async function registerUser(input: RegisterInput): Promise<{
  user: { id: string; email: string };
  tokens: AuthTokens;
}> {
  const email = input.email.trim().toLowerCase();

  // Validar ubicaciones referenciadas antes de crear (mensajes claros)
  const [country, department, municipality] = await Promise.all([
    prisma.country.findUnique({ where: { id: input.person.countryId } }),
    prisma.department.findUnique({ where: { id: input.person.departmentId } }),
    prisma.municipality.findUnique({ where: { id: input.person.municipalityId } }),
  ]);
  if (!country || !department || !municipality) {
    throw new AppError('VALIDATION_ERROR', 'Ubicación inválida (país/departamento/municipio)');
  }
  if (department.countryId !== country.id || municipality.departmentId !== department.id) {
    throw new AppError('VALIDATION_ERROR', 'La jerarquía país→departamento→municipio no coincide');
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new AppError('CONFLICT', 'El correo ya está registrado');
  }
  const existingDni = await prisma.person.findUnique({ where: { dni: input.person.dni } });
  if (existingDni) {
    throw new AppError('CONFLICT', 'El DNI ya está registrado');
  }

  const passwordHash = await hashPassword(input.password);
  const roleName = input.accountType; // PATIENT | EMPLOYEE coinciden con los roles sembrados

  const user = await prisma.$transaction(async (tx) => {
    const createdPerson = await tx.person.create({
      data: {
        firstName: input.person.firstName,
        middleName: input.person.middleName,
        lastName: input.person.lastName,
        secondLastName: input.person.secondLastName,
        birthDate: new Date(input.person.birthDate),
        dni: input.person.dni,
        gender: input.person.gender,
        address: input.person.address,
        countryId: input.person.countryId,
        departmentId: input.person.departmentId,
        municipalityId: input.person.municipalityId,
      },
    });

    const createdUser = await tx.user.create({
      data: {
        personId: createdPerson.id,
        email,
        passwordHash,
      },
    });

    if (input.accountType === 'PATIENT') {
      await tx.patient.create({
        data: { userId: createdUser.id, bloodType: input.bloodType },
      });
    } else {
      await tx.employee.create({ data: { userId: createdUser.id } });
    }

    const role = await tx.role.findUnique({ where: { name: roleName } });
    if (!role) {
      throw new AppError('INTERNAL_ERROR', `Rol '${roleName}' no existe en el catálogo`);
    }
    await tx.userRole.create({
      data: { userId: createdUser.id, roleId: role.id },
    });

    return createdUser;
  });

  try {
    const tokens = await issueTokenPair(user);
    return { user: { id: user.id, email: user.email }, tokens };
  } catch (error) {
    mapUniqueViolation(error, '');
    throw error;
  }
}

/**
 * Login con credenciales. Errores genéricos para evitar enumeración
 * de usuarios (mismo mensaje y estado ante correo inexistente o
 * contraseña incorrecta).
 */
export async function loginUser(email: string, password: string): Promise<{
  user: { id: string; email: string; roles: string[] };
  tokens: AuthTokens;
}> {
  const normalized = email.trim().toLowerCase();
  const genericError = (): AppError =>
    new AppError('UNAUTHORIZED', 'Correo o contraseña incorrectos');

  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user || user.deletedAt) throw genericError();

  const passwordOk = await verifyPassword(user.passwordHash, password);
  if (!passwordOk) throw genericError();

  if (user.status !== 'ACTIVE') {
    throw new AppError('FORBIDDEN', 'La cuenta no está activa');
  }

  const roles = await getRoleNames(user.id);
  const accessToken = signAccessToken({ sub: user.id, roles });
  const { refreshToken } = await issueRefreshToken(user.id);

  return {
    user: { id: user.id, email: user.email, roles },
    tokens: { accessToken, refreshToken },
  };
}

/**
 * Solicitud de restablecimiento: siempre responde sin revelar si el
 * correo existe (anti-enumeración). Crea token de un uso y "envía" correo.
 */
export async function requestPasswordReset(
  email: string,
  mailer: Mailer
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email: normalized, deletedAt: null },
  });

  if (user) {
    // Invalidar solicitudes previas pendientes del mismo usuario
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const rawToken = randomBytes(32).toString('base64url');
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(rawToken),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000),
      },
    });

    await mailer.sendPasswordResetEmail(normalized, rawToken);
  }
}

/** Confirma restablecimiento: valida token, actualiza contraseña y revoca sesiones. */
export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const stored = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: sha256(rawToken) },
  });

  if (!stored || stored.usedAt) {
    throw new AppError('VALIDATION_ERROR', 'Token de restablecimiento inválido');
  }
  if (stored.expiresAt.getTime() < Date.now()) {
    throw new AppError('VALIDATION_ERROR', 'El token de restablecimiento expiró');
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: stored.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: stored.id },
      data: { usedAt: new Date() },
    }),
  ]);

  await revokeAllUserSessions(stored.userId);
}

/** Cambio de contraseña para usuario autenticado; invalida todas las sesiones. */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('NOT_FOUND', 'Usuario no encontrado');

  const currentOk = await verifyPassword(user.passwordHash, currentPassword);
  if (!currentOk) {
    throw new AppError('UNAUTHORIZED', 'La contraseña actual es incorrecta');
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  await revokeAllUserSessions(userId);
}
