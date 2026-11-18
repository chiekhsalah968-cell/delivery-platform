import { PrismaClient } from '@prisma/client';

export * from '@prisma/client';
export { WILAYAS } from './data/wilayas';
export { MUNICIPALITIES } from './data/municipalities';

export function createPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: databaseUrl } },
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}