#!/usr/bin/env tsx
// Script para crear un usuario doctor de prueba
// Ejecutar: npx tsx scripts/create-doctor-user.ts

import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/modules/auth/password.service.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🔧 Creando usuario doctor de prueba...\n');

  // 1. Obtener ubicación de prueba
  const country = await prisma.country.findFirstOrThrow({ where: { name: 'Honduras' } });
  const department = await prisma.department.findFirstOrThrow({
    where: { name: 'Francisco Morazán' },
  });
  const municipality = await prisma.municipality.findFirstOrThrow({
    where: { name: 'Tegucigalpa', departmentId: department.id },
  });

  // 2. Crear persona
  const dni = `08011975${Date.now().toString().slice(-6)}`;
  const person = await prisma.person.create({
    data: {
      firstName: 'Carlos',
      lastName: 'García',
      middleName: 'Alberto',
      secondLastName: 'López',
      birthDate: new Date('1975-03-15'),
      dni,
      gender: 'M',
      address: 'Colonia Palmira, Calle Principal, Casa 123, Tegucigalpa',
      countryId: country.id,
      departmentId: department.id,
      municipalityId: municipality.id,
    },
  });
  console.log(`✅ Persona creada: ${person.firstName} ${person.lastName} (DNI: ${dni}, ID: ${person.id})`);

  // 3. Crear usuario con contraseña
  const email = `doctor.garcia.${Date.now()}@medicitas.hn`;
  const password = 'Doctor123!';
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

  // 4. Asignar rol DOCTOR
  const doctorRole = await prisma.role.findFirstOrThrow({ where: { name: 'DOCTOR' } });
  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: doctorRole.id,
      status: 'ACTIVE',
    },
  });
  console.log(`✅ Rol DOCTOR asignado`);

  // 4.1 También asignar rol PATIENT para que pueda ser paciente también
  const patientRole = await prisma.role.findFirstOrThrow({ where: { name: 'PATIENT' } });
  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: patientRole.id,
      status: 'ACTIVE',
    },
  });
  console.log(`✅ Rol PATIENT asignado (para perfil de paciente)`);

  // 5. Crear perfil de paciente
  const patient = await prisma.patient.create({
    data: {
      userId: user.id,
      bloodType: 'O_POSITIVE',
      emergencyContactName: 'María García',
      emergencyContactNumber: '3123-4567',
      allergies: 'Ninguna conocida',
    },
  });
  console.log(`✅ Perfil de paciente creado (ID: ${patient.id})`);

  // 6. Crear empleado
  const employee = await prisma.employee.create({
    data: {
      userId: user.id,
      status: 'ACTIVE',
    },
  });
  console.log(`✅ Empleado creado (ID: ${employee.id})`);

  // 7. Asignar cargo (crear "Médico Especialista" si no existe)
  let cargo = await prisma.cargo.findFirst({ where: { name: 'Médico Especialista' } });
  if (!cargo) {
    cargo = await prisma.cargo.create({
      data: {
        name: 'Médico Especialista',
        status: 'ACTIVE',
      },
    });
    console.log(`✅ Cargo "Médico Especialista" creado`);
  }
  await prisma.employeeCargo.create({
    data: {
      employeeId: employee.id,
      cargoId: cargo.id,
    },
  });
  console.log(`✅ Cargo "${cargo.name}" asignado`);

  // 8. Crear doctor
  const doctor = await prisma.doctor.create({
    data: {
      employeeId: employee.id,
      status: 'ACTIVE',
    },
  });
  console.log(`✅ Doctor creado (ID: ${doctor.id})`);

  // 9. Asignar especialidad (Cardiología)
  const specialty = await prisma.specialty.findFirstOrThrow({ where: { name: 'Cardiología' } });
  await prisma.doctorSpecialty.create({
    data: {
      doctorId: doctor.id,
      specialtyId: specialty.id,
      status: 'ACTIVE',
    },
  });
  console.log(`✅ Especialidad "Cardiología" asignada`);

  // 10. Crear horario para el doctor (Lunes a Viernes 8:00-12:00)
  // Bitmask: Lunes=1, Martes=2, Miércoles=4, Jueves=8, Viernes=16 = 31
  const schedule = await prisma.schedule.create({
    data: {
      doctorId: doctor.id,
      specialtyId: specialty.id,
      daysBitmask: 31, // Lun-Vie
      startTime: '08:00',
      endTime: '12:00',
      slotCapacity: 4,
      observation: 'Consulta matutina Cardiología',
      timezone: 'America/Tegucigalpa',
      status: 'ACTIVE',
    },
  });
  console.log(`✅ Horario creado: Lun-Vie 08:00-12:00 (4 cupos) - ID: ${schedule.id}`);

  // 11. Crear segundo horario (Lunes y Miércoles 14:00-18:00)
  // Bitmask: Lunes=1, Miércoles=4 = 5
  const schedule2 = await prisma.schedule.create({
    data: {
      doctorId: doctor.id,
      specialtyId: specialty.id,
      daysBitmask: 5, // Lun y Mié
      startTime: '14:00',
      endTime: '18:00',
      slotCapacity: 3,
      observation: 'Consulta vespertina Cardiología',
      timezone: 'America/Tegucigalpa',
      status: 'ACTIVE',
    },
  });
  console.log(`✅ Horario creado: Lun/Mié 14:00-18:00 (3 cupos) - ID: ${schedule2.id}`);

  console.log('\n✅✅✅ USUARIO DOCTOR CREADO EXITOSAMENTE ✅✅✅\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📧 Email: doctor.garcia@medicitas.hn');
  console.log('🔑 Password: Doctor123!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n👨‍⚕️ Doctor: Dr. Carlos Alberto García López');
  console.log('🏥 Especialidad: Cardiología');
  console.log('📅 Horarios:');
  console.log('   - Lun-Vie 08:00-12:00 (4 cupos)');
  console.log('   - Lun/Mié 14:00-18:00 (3 cupos)');
  console.log('\n🔗 Login en: http://localhost:3002/login');
  console.log('📋 Agenda en: http://localhost:3002/agenda\n');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Error:', e);
  process.exit(1);
});