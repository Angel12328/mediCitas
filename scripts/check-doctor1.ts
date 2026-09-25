#!/usr/bin/env tsx
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'doctor1@medicitas.com' },
    include: {
      person: true,
      roles: true,
    }
  });
  console.log('User:', JSON.stringify(user, null, 2));
  await prisma.$disconnect();
}

main().catch(console.error);