#!/usr/bin/env tsx
// Script para crear un usuario administrador
// Ejecutar: npx tsx scripts/create-admin-user.ts

import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/modules/auth/password.service.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🔧 Creando usuario administrador...\n');

  // 1. Obtener ubicación de prueba
  const country = await prisma.country.findFirstOrThrow({ where: { name: 'Honduras' } });
  const department = await prisma.department.findFirstOrThrow({
    where: { name: 'Francisco Morazán' },
  });
  const municipality = await prisma.municipality.findFirstOrThrow({
    where: { name: 'Tegucigalpa', departmentId: department.id },
  });

  // 2. Crear persona
  const dni = `08011980${Date.now().toString().slice(-6)}`;
  const person = await prisma.person.create({
    data: {
      firstName: 'Admin',
      lastName: 'Sistema',
      middleName: 'Principal',
      secondLastName: 'Root',
      birthDate: new Date('1980-01-01'),
      dni,
      gender: 'M',
      address: 'Centro Administrativo, Tegucigalpa',
      countryId: country.id,
      departmentId: department.id,
      municipalityId: municipality.id,
    },
  });
  console.log(`✅ Persona creada: ${person.firstName} ${person.lastName} (DNI: ${dni}, ID: ${person.id})`);

  // 3. Crear usuario con contraseña
  const email = 'admin@medicitas.hn';
  const password = 'Admin123!';
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      status: 'ACTIVE',
      personId: person.id,
    },
  });
  console.log(`✅ Usuario creado: ${email} (ID: ${user.id})`);

  // 4. Asignar rol ADMIN
  const adminRole = await prisma.role.findFirstOrThrow({ where: { name: 'ADMIN' } });
  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: adminRole.id,
      status: 'ACTIVE',
    },
  });
  console.log(`✅ Rol ADMIN asignado`);

  // 5. También asignar EMPLOYEE para acceso a panel admin
  const employeeRole = await prisma.role.findFirstOrThrow({ where: { name: 'EMPLOYEE' } });
  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: employeeRole.id,
      status: 'ACTIVE',
    },
  });
  console.log(`✅ Rol EMPLOYEE asignado`);

  // 6. Crear empleado
  const employee = await prisma.employee.create({
    data: {
      userId: user.id,
      status: 'ACTIVE',
    },
  });
  console.log(`✅ Empleado creado (ID: ${employee.id})`);

  // 7. Asignar cargo de Administrador
  let cargo = await prisma.cargo.findFirst({ where: { name: 'Administrador' } });
  if (!cargo) {
    cargo = await prisma.cargo.create({
      data: {
        name: 'Administrador',
        status: 'ACTIVE',
      },
    });
    console.log(`✅ Cargo "Administrador" creado`);
  }
  await prisma.employeeCargo.create({
    data: {
      employeeId: employee.id,
      cargoId: cargo.id,
    },
  });
  console.log(`✅ Cargo "${cargo.name}" asignado`);

  console.log('\n✅✅✅ USUARIO ADMINISTRADOR CREADO EXITOSAMENTE ✅✅✅\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📧 Email: admin@medicitas.hn');
  console.log('🔑 Password: Admin123!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n👤 Admin: Admin Principal Root');
  console.log('🔗 Login en: https://web-self-eight-c3lnokun26.vercel.app/login');
  console.log('⚙️ Panel admin: https://web-self-eight-c3lnokun26.vercel.app/administracion\n');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Error:', e);
  process.exit(1);
});