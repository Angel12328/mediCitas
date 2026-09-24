#!/usr/bin/env tsx
// Script para crear un usuario paciente de prueba
// Ejecutar: npx tsx scripts/create-patient-user.ts

import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/modules/auth/password.service.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🔧 Creando usuario paciente de prueba...\n');

  // 1. Obtener ubicación de prueba
  const country = await prisma.country.findFirstOrThrow({ where: { name: 'Honduras' } });
  const department = await prisma.department.findFirstOrThrow({
    where: { name: 'Francisco Morazán' },
  });
  const municipality = await prisma.municipality.findFirstOrThrow({
    where: { name: 'Tegucigalpa', departmentId: department.id },
  });

  // 2. Crear persona
  const dni = `08011990${Date.now().toString().slice(-6)}`;
  const person = await prisma.person.create({
    data: {
      firstName: 'María',
      lastName: 'Fernández',
      middleName: 'José',
      secondLastName: 'Pérez',
      birthDate: new Date('1990-05-20'),
      dni,
      gender: 'F',
      address: 'Residencial Los Próceres, Bloque 5, Casa 8, Tegucigalpa',
      countryId: country.id,
      departmentId: department.id,
      municipalityId: municipality.id,
    },
  });
  console.log(`✅ Persona creada: ${person.firstName} ${person.lastName} (DNI: ${dni}, ID: ${person.id})`);

  // 3. Crear usuario con contraseña
  const email = `paciente.fernandez.${Date.now()}@medicitas.hn`;
  const password = 'Paciente123!';
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

  // 4. Asignar rol PATIENT
  const patientRole = await prisma.role.findFirstOrThrow({ where: { name: 'PATIENT' } });
  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: patientRole.id,
      status: 'ACTIVE',
    },
  });
  console.log(`✅ Rol PATIENT asignado`);

  // 5. Crear perfil de paciente
  const patient = await prisma.patient.create({
    data: {
      userId: user.id,
      bloodType: 'A_POSITIVE',
      emergencyContactName: 'Carlos Fernández',
      emergencyContactNumber: '3123-4567',
      allergies: 'Penicilina',
    },
  });
  console.log(`✅ Perfil de paciente creado (ID: ${patient.id})`);

  console.log('\n✅✅✅ USUARIO PACIENTE CREADO EXITOSAMENTE ✅✅✅\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📧 Email: ${email}`);
  console.log('🔑 Password: Paciente123!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n👩 Paciente: María José Fernández Pérez');
  console.log('🩸 Tipo de sangre: A_POSITIVE');
  console.log('⚠️ Alergias: Penicilina');
  console.log('📞 Contacto emergencia: Carlos Fernández - 3123-4567');
  console.log('\n🔗 Login en: http://localhost:3002/login');
  console.log('📅 Mis citas en: http://localhost:3002/mis-citas');
  console.log('📅 Agendar cita en: http://localhost:3002/citas/agendar\n');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Error:', e);
  process.exit(1);
});