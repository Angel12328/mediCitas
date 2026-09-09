// Configuración de la aplicación validada con Zod - mediCitas API
import { z } from 'zod';
export const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.url(),
    JWT_ACCESS_SECRET: z.string().min(16),
    JWT_REFRESH_SECRET: z.string().min(16),
    JWT_ACCESS_EXPIRES_IN: z
        .string()
        .regex(/^\d+[smhd]$/, 'formato esperado: <número><s|m|h|d>')
        .default('15m'),
    JWT_REFRESH_EXPIRES_IN: z
        .string()
        .regex(/^\d+[smhd]$/, 'formato esperado: <número><s|m|h|d>')
        .default('7d'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});
let cached = null;
/**
 * Carga y valida las variables de entorno.
 * Lanza error descriptivo si falta alguna variable requerida.
 */
export function loadEnv(source = process.env) {
    const result = envSchema.safeParse(source);
    if (!result.success) {
        const issues = result.error.issues
            .map((issue) => `  - ${issue.path.join('.') || '(raíz)'}: ${issue.message}`)
            .join('\n');
        throw new Error(`Configuración de entorno inválida:\n${issues}`);
    }
    return result.data;
}
/** Instancia cacheada para uso en la aplicación (main.ts). */
export function getEnv() {
    if (!cached) {
        cached = loadEnv();
    }
    return cached;
}
//# sourceMappingURL=env.js.map