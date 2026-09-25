#!/usr/bin/env tsx
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const role = await prisma.role.findUnique({
    where: { id: 'c03ffa09-bf56-4dc4-98ae-4e34a6dfce6b' }
  });
  console.log('Role:', JSON.stringify(role, null, 2));
  await prisma.$disconnect();
}

main().catch(console.error);