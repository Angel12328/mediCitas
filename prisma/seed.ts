// Seed de datos de referencia - mediCitas API
// Ejecutar: npm run db:seed
import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

interface CountrySeed {
  name: string;
  departments: { name: string; municipalities: string[] }[];
}

const DATA: CountrySeed[] = [
  {
    name: 'Honduras',
    departments: [
      {
        name: 'Francisco Morazán',
        municipalities: ['Tegucigalpa', 'Comayagüela', 'Santa Lucía', 'Valle de Ángeles', 'Ojojona'],
      },
      {
        name: 'Cortés',
        municipalities: ['San Pedro Sula', 'Choloma', 'Puerto Cortés', 'La Lima', 'Villanueva'],
      },
      {
        name: 'Atlántida',
        municipalities: ['La Ceiba', 'Tela', 'El Porvenir', 'Jutiapa'],
      },
      {
        name: 'Colón',
        municipalities: ['Trujillo', 'Tocoa', 'Sonaguera'],
      },
      {
        name: 'Comayagua',
        municipalities: ['Comayagua', 'Siguatepeque', 'La Libertad'],
      },
      {
        name: 'Copán',
        municipalities: ['Copán Ruinas', 'Santa Rosa de Copán', 'La Entrada'],
      },
      {
        name: 'El Paraíso',
        municipalities: ['Yuscarán', 'Danlí', 'Juticalpa'],
      },
      {
        name: 'Choluteca',
        municipalities: ['Choluteca', 'Ciudad Choluteca', 'Nacaome'],
      },
      {
        name: 'Olancho',
        municipalities: ['Juticalpa', 'Catacamas', 'Salamá'],
      },
      {
        name: 'Yoro',
        municipalities: ['Yoro', 'El Progreso', 'Olanchito'],
      },
    ],
  },
];

const ROLES = [
  { name: 'ADMIN', description: 'Administrador del sistema' },
  { name: 'DOCTOR', description: 'Doctor con acceso a su agenda y pacientes' },
  { name: 'PATIENT', description: 'Paciente con acceso a sus citas' },
  { name: 'EMPLOYEE', description: 'Empleado de recepción/administración' },
];

const SPECIALTIES = [
  'Medicina General',
  'Pediatría',
  'Cardiología',
  'Dermatología',
  'Ginecología y Obstetricia',
  'Odontología',
  'Oftalmología',
  'Traumatología',
  'Otorrinolaringología',
  'Medicina Interna',
  'Neurología',
  'Psiquiatría',
];

const CARGOS = [
  'Recepcionista',
  'Administrador de Clínica',
  'Enfermera/o',
  'Auxiliar Administrativo',
  'Facturación',
  'Coordinador de Citas',
];

const EXTENSIONS = [
  'Oficina Principal',
  'Recepción',
  'Consultorio 1',
  'Consultorio 2',
  'Emergencias',
  'Farmacia',
  'Laboratorio',
];

async function main(): Promise<void> {
  console.log('🌱 Iniciando seed de datos de referencia...');

  // Países -> Departamentos -> Municipios
  for (const countryData of DATA) {
    const country = await prisma.country.upsert({
      where: { name: countryData.name },
      update: {},
      create: { name: countryData.name },
    });
    console.log(`   País: ${country.name}`);

    for (const deptData of countryData.departments) {
      const department = await prisma.department.upsert({
        where: { name_countryId: { name: deptData.name, countryId: country.id } },
        update: {},
        create: { name: deptData.name, countryId: country.id },
      });

      for (const munName of deptData.municipalities) {
        await prisma.municipality.upsert({
          where: { name_departmentId: { name: munName, departmentId: department.id } },
          update: {},
          create: { name: munName, departmentId: department.id },
        });
      }
      console.log(`   Departamento: ${department.name} (${deptData.municipalities.length} municipios)`);
    }
  }

  // Roles
  for (const role of ROLES) {
    await prisma.role.upsert({ where: { name: role.name }, update: {}, create: role });
  }
  console.log(`   Roles: ${ROLES.length}`);

  // Especialidades
  for (const name of SPECIALTIES) {
    await prisma.specialty.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`   Especialidades: ${SPECIALTIES.length}`);

  // Cargos
  for (const name of CARGOS) {
    await prisma.cargo.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`   Cargos: ${CARGOS.length}`);

  // Extensiones
  for (const name of EXTENSIONS) {
    await prisma.extension.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`   Extensiones: ${EXTENSIONS.length}`);

  const counts = {
    countries: await prisma.country.count(),
    departments: await prisma.department.count(),
    municipalities: await prisma.municipality.count(),
    roles: await prisma.role.count(),
    specialties: await prisma.specialty.count(),
    cargos: await prisma.cargo.count(),
    extensions: await prisma.extension.count(),
  };

  console.log('\n✅ Seed completado. Registros en base de datos:');
  console.table(counts);
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
