import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    testTimeout: 15000,
    hookTimeout: 15000,
    // Los archivos comparten la misma base de datos: ejecutarlos en serie
    // evita que la limpieza de uno interfiera con otro.
    fileParallelism: false,
  },
});
