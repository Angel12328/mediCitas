#!/usr/bin/env tsx
// Script para listar doctores
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const doctors = await prisma.doctor.findMany({
    where: { deletedAt: null, status: 'ACTIVE' },
    include: {
      employee: {
        include: {
          user: {
            include: {
              person: true,
              roles: true
            }
          }
        }
      },
      specialties: { include: { specialty: true } }
    }
  });
  
  for (const d of doctors) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Doctor ID:', d.id);
    console.log('Nombre:', d.employee?.user?.person?.firstName, d.employee?.user?.person?.lastName);
    console.log('Email:', d.employee?.user?.email);
    console.log('Roles:', d.employee?.user?.roles?.map(r => r.name).join(', '));
    console.log('Especialidades:', d.specialties.map(ds => ds.specialty.name).join(', '));
    console.log('Status:', d.status);
    console.log('');
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);