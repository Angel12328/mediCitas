// Helpers compartidos para tests de integración
import { prisma } from '../../src/shared/database/client.js';
import type { Mailer } from '../../src/shared/mail/mailer.js';

/** Mailer falso que captura los envíos para aserciones */
export class FakeMailer implements Mailer {
  readonly sent: Array<{ to: string; resetToken: string }> = [];

  async sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
    this.sent.push({ to, resetToken });
  }
}

const TEST_MARKER = '@auth-test.local';

/** Elimina todos los datos generados por tests (por marcador de email) */
export async function purgeTestUsers(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { email: { contains: TEST_MARKER } },
    select: { id: true, personId: true },
  });
  const userIds = users.map((u) => u.id);
  const personIds = users.map((u) => u.personId);

  // Citas vinculadas a pacientes O horarios de prueba (pueden quedar
  // huérfanas si una corrida previa se interrumpió antes de limpiar)
  await prisma.appointment.deleteMany({
    where: {
      OR: [
        { patient: { userId: { in: userIds } } },
        { schedule: { doctor: { employee: { userId: { in: userIds } } } } },
      ],
    },
  });

  await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.patient.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.doctorSpecialty.deleteMany({
    where: { doctor: { employee: { userId: { in: userIds } } } },
  });
  await prisma.schedule.deleteMany({
    where: { doctor: { employee: { userId: { in: userIds } } } },
  });
  await prisma.doctor.deleteMany({
    where: { employee: { userId: { in: userIds } } },
  });
  await prisma.employeeCargo.deleteMany({
    where: { employee: { userId: { in: userIds } } },
  });
  await prisma.employee.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.phone.deleteMany({ where: { person: { user: { id: { in: userIds } } } } });
  // user antes que person (FK users_person_id_fkey)
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.person.deleteMany({ where: { id: { in: personIds } } });
}

/** Ubicación válida sembrada para registros de prueba */
export async function getSeedLocation(): Promise<{
  countryId: string;
  departmentId: string;
  municipalityId: string;
}> {
  const country = await prisma.country.findFirstOrThrow({ where: { name: 'Honduras' } });
  const department = await prisma.department.findFirstOrThrow({
    where: { name: 'Francisco Morazán' },
  });
  const municipality = await prisma.municipality.findFirstOrThrow({
    where: { name: 'Tegucigalpa', departmentId: department.id },
  });
  return { countryId: country.id, departmentId: department.id, municipalityId: municipality.id };
}

export function uniqueEmail(prefix = 'user'): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}${TEST_MARKER}`;
}

/** DNI único para registros de prueba (máx 20 caracteres) */
export function uniqueDni(prefix = 'TST'): string {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 1e6)}`.slice(0, 20);
}

export { TEST_MARKER };
