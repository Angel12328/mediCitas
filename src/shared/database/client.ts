// Cliente Prisma singleton - mediCitas API
import { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as { __medicitasPrisma?: PrismaClient };

export function createPrismaClient(databaseUrl?: string): PrismaClient {
  const connectionString = databaseUrl ?? process.env['DATABASE_URL'];
  if (!connectionString) {
    throw new Error('DATABASE_URL no está definida en las variables de entorno');
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalForPrisma.__medicitasPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__medicitasPrisma = prisma;
}
