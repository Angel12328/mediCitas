import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const cargos = await prisma.cargo.findMany();
console.log('Cargos disponibles:');
cargos.forEach(c => console.log(`  - ${c.name} (${c.id})`));

await prisma.$disconnect();