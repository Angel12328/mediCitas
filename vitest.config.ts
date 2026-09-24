import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    testTimeout: 15000,
    hookTimeout: 15000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@prisma/client': '/home/angel/Documentos/portafolioDev/mediCitas-proyect/node_modules/@prisma/client',
    },
  },
});
