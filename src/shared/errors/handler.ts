import type {
  FastifyError,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import { ZodError } from 'zod';
import { AppError, PROBLEM_JSON_MEDIA_TYPE, type ProblemDetails } from './app-error.js';
import type { AnyFastifyInstance } from '../fastify-types.js';

function toProblemDetails(error: FastifyError, request: FastifyRequest): ProblemDetails {
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
  const statusCode = (error as { statusCode?: number }).statusCode;
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
export function registerErrorHandler(app: AnyFastifyInstance): void {
  app.setErrorHandler(
    (error: FastifyError, request: FastifyRequest, reply: FastifyReply): void => {
      const problem = toProblemDetails(error, request);
      reply.status(problem.status).type(PROBLEM_JSON_MEDIA_TYPE).send(problem);
    }
  );

  app.setNotFoundHandler((request, reply) => {
    const problem = new AppError('NOT_FOUND', `Ruta no encontrada: ${request.method} ${request.url}`).toProblemDetails(
      request.url
    );
    reply.status(problem.status).type(PROBLEM_JSON_MEDIA_TYPE).send(problem);
  });
}
