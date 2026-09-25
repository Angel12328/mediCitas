#!/usr/bin/env tsx
// Reset password for doctor1@medicitas.com to "Doctor123!"
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/modules/auth/password.service.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = 'doctor1@medicitas.com';
  const newPassword = 'Doctor123!';
  const passwordHash = await hashPassword(newPassword);

  const user = await prisma.user.update({
    where: { email },
    data: { passwordHash },
  });

  console.log(`✅ Password reset for ${email} to: ${newPassword}`);
  console.log(`User ID: ${user.id}`);

  await prisma.$disconnect();
}

main().catch(console.error);