// Logging estructurado JSON - mediCitas API
import pino from 'pino';
const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];
export function resolveLogLevel(source = process.env) {
    const candidate = source['LOG_LEVEL'];
    return LOG_LEVELS.includes(candidate) ? candidate : 'info';
}
/** Crea una instancia pino que emite líneas JSON. */
export function createLogger(options = {}) {
    const level = options.level ?? resolveLogLevel();
    if (options.stream) {
        return pino({ level }, options.stream);
    }
    return pino({ level });
}
/**
 * Logger de la aplicación.
 * Emite JSON estructurado por defecto en todos los entornos.
 * El formato "pretty" es opt-in con LOG_PRETTY=true (desarrollo local).
 */
function buildDefaultLogger() {
    const level = resolveLogLevel();
    if (process.env['LOG_PRETTY'] === 'true') {
        return pino({
            level,
            transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
        });
    }
    return pino({ level });
}
export const logger = buildDefaultLogger();
//# sourceMappingURL=logger.js.map