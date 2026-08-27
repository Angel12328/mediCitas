import { ZodError } from 'zod';
import { AppError, PROBLEM_JSON_MEDIA_TYPE } from './app-error.js';
function toProblemDetails(error, request) {
    const requestUrl = request.url;
    if (error instanceof AppError) {
        return error.toProblemDetails(requestUrl);
    }
    if (error instanceof ZodError) {
        return new AppError('VALIDATION_ERROR', 'Datos inválidos', {
            details: error.issues,
        }).toProblemDetails(requestUrl);
    }
    if (error.validation !== undefined) {
        return new AppError('VALIDATION_ERROR', error.message, {
            details: error.validation,
        }).toProblemDetails(requestUrl);
    }
    // Errores HTTP de plugins con status 4xx (ej. rate limit 429): preservar código
    const statusCode = error.statusCode;
    if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
        return {
            type: 'https://medicitas.example.com/problems/request-rejected',
            title: error.message || 'Solicitud rechazada',
            status: statusCode,
            instance: requestUrl,
        };
    }
    // Error no controlado: nunca filtrar detalles internos
    request.log.error({ err: error }, 'Error interno no controlado');
    return new AppError('INTERNAL_ERROR').toProblemDetails(requestUrl);
}
/**
 * Acepta cualquier instanciación de FastifyInstance para permitir loggers
 * personalizados (pino) sin romper la varianza de genéricos.
 */
export function registerErrorHandler(app) {
    app.setErrorHandler((error, request, reply) => {
        const problem = toProblemDetails(error, request);
        reply.status(problem.status).type(PROBLEM_JSON_MEDIA_TYPE).send(problem);
    });
    app.setNotFoundHandler((request, reply) => {
        const problem = new AppError('NOT_FOUND', `Ruta no encontrada: ${request.method} ${request.url}`).toProblemDetails(request.url);
        reply.status(problem.status).type(PROBLEM_JSON_MEDIA_TYPE).send(problem);
    });
}
//# sourceMappingURL=handler.js.map