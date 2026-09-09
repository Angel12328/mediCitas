// Seed de datos operacionales - mediCitas API
// Crea doctores, horarios, y paciente de prueba para agendar citas
// Ejecutar: npx tsx prisma/seed-operational.ts
import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/modules/auth/password.service.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  console.log('🏥 Creando datos operacionales...\n');

  const PASSWORD_HASH = await hashPassword('Password123!');

  // 1. Obtener datos base del seed anterior
  const country = await prisma.country.findFirst({ where: { name: 'Honduras' } });
  const department = await prisma.department.findFirst({ where: { name: 'Francisco Morazán' } });
  const municipality = await prisma.municipality.findFirst({ where: { name: 'Tegucigalpa' } });

  if (!country || !department || !municipality) {
    console.error('❌ Ejecuta primero: npm run db:seed');
    process.exit(1);
  }

  const roleDoctor = await prisma.role.findFirst({ where: { name: 'DOCTOR' } });
  const rolePatient = await prisma.role.findFirst({ where: { name: 'PATIENT' } });
  const cargo = await prisma.cargo.findFirst({ where: { name: 'Administrador de Clínica' } });
  const extension = await prisma.extension.findFirst({ where: { name: 'Consultorio 1' } });

  if (!roleDoctor || !rolePatient || !cargo || !extension) {
    console.error('❌ Faltan roles o cargos. Ejecuta: npm run db:seed');
    process.exit(1);
  }

  const specialties = await prisma.specialty.findMany();
  const specialtyMap = new Map(specialties.map(s => [s.name, s.id]));

  // 2. Crear 3 doctores con personas, usuarios, empleados
  const doctors = [
    { first: 'Carlos', last: 'Martínez', email: 'doctor1@medicitas.com', specialty: 'Medicina General' },
    { first: 'María', last: 'López', email: 'doctor2@medicitas.com', specialty: 'Pediatría' },
    { first: 'Roberto', last: 'García', email: 'doctor3@medicitas.com', specialty: 'Cardiología' },
  ];

  const doctorIds: string[] = [];

  for (const doc of doctors) {
    // Person
    const person = await prisma.person.create({
      data: {
        firstName: doc.first,
        lastName: doc.last,
        birthDate: new Date('1985-06-15'),
        dni: `08011985${Math.floor(Math.random() * 9000 + 1000)}`,
        gender: 'M',
        countryId: country.id,
        departmentId: department.id,
        municipalityId: municipality.id,
      },
    });

    // User
    const user = await prisma.user.create({
      data: {
        personId: person.id,
        email: doc.email,
        passwordHash: PASSWORD_HASH,
      },
    });

    // UserRole
    await prisma.userRole.create({
      data: { userId: user.id, roleId: roleDoctor.id },
    });

    // Employee
    const employee = await prisma.employee.create({
      data: { userId: user.id },
    });

    // Cargo
    await prisma.employeeCargo.create({
      data: { employeeId: employee.id, cargoId: cargo.id },
    });

    // Doctor
    const doctor = await prisma.doctor.create({
      data: { employeeId: employee.id },
    });

    // DoctorSpecialty
    const specId = specialtyMap.get(doc.specialty);
    if (specId) {
      await prisma.doctorSpecialty.create({
        data: { doctorId: doctor.id, specialtyId: specId },
      });
    }

    doctorIds.push(doctor.id);
    console.log(`   ✅ Doctor: ${doc.first} ${doc.last} (${doc.email}) - ${doc.specialty}`);
  }

  // 3. Crear horarios para cada doctor (lunes a viernes, 8:00-12:00 y 14:00-17:00)
  // Bitmask: lunes=1, martes=2, miércoles=4, jueves=8, viernes=16 → 31
  const weekdayBitmask = 31;
  const schedules: { id: string; doctorId: string; specialtyId: string }[] = [];

  for (const doctorId of doctorIds) {
    const docSpecialties = await prisma.doctorSpecialty.findMany({
      where: { doctorId },
    });

    for (const ds of docSpecialties) {
      // Turno mañana
      const morning = await prisma.schedule.create({
        data: {
          doctorId,
          specialtyId: ds.specialtyId,
          daysBitmask: weekdayBitmask,
          startTime: '08:00',
          endTime: '12:00',
          slotCapacity: 10,
          observation: 'Turno mañana',
        },
      });
      schedules.push({ id: morning.id, doctorId, specialtyId: ds.specialtyId });

      // Turno tarde
      const afternoon = await prisma.schedule.create({
        data: {
          doctorId,
          specialtyId: ds.specialtyId,
          daysBitmask: weekdayBitmask,
          startTime: '14:00',
          endTime: '17:00',
          slotCapacity: 8,
          observation: 'Turno tarde',
        },
      });
      schedules.push({ id: afternoon.id, doctorId, specialtyId: ds.specialtyId });
    }
  }
  console.log(`\n   ✅ ${schedules.length} horarios creados (mañana + tarde)`);

  // 4. Crear paciente de prueba
  const patientPerson = await prisma.person.create({
    data: {
      firstName: 'Juan',
      lastName: 'Pérez',
      birthDate: new Date('1990-03-20'),
      dni: '0801199012345',
      gender: 'M',
      countryId: country.id,
      departmentId: department.id,
      municipalityId: municipality.id,
    },
  });

  const patientUser = await prisma.user.create({
    data: {
      personId: patientPerson.id,
      email: 'paciente@medicitas.com',
      passwordHash: PASSWORD_HASH,
    },
  });

  await prisma.userRole.create({
    data: { userId: patientUser.id, roleId: rolePatient.id },
  });

  await prisma.patient.create({
    data: {
      userId: patientUser.id,
      bloodType: 'O_POSITIVE',
    },
  });

  console.log(`   ✅ Paciente: Juan Pérez (paciente@medicitas.com)`);

  // Resumen
  console.log('\n📋 Datos creados:');
  console.log(`   Doctores: ${doctors.length}`);
  console.log(`   Horarios: ${schedules.length}`);
  console.log(`   Paciente: 1`);

  console.log('\n🔑 Credenciales de prueba:');
  console.log('   Doctor 1: doctor1@medicitas.com / Password123!');
  console.log('   Doctor 2: doctor2@medicitas.com / Password123!');
  console.log('   Doctor 3: doctor3@medicitas.com / Password123!');
  console.log('   Paciente: paciente@medicitas.com / Password123!');

  console.log('\n✅ Listo para agendar citas');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
