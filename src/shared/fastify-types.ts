// Tipos compartidos de infraestructura - mediCitas API
/* eslint-disable @typescript-eslint/no-explicit-any -- necesario para
   aceptar cualquier instanciación genérica de Fastify (loggers custom) */
import type { FastifyInstance } from 'fastify';

/**
 * Instancia Fastify con genéricos relajados. Usar SOLO en funciones
 * de registro de plugins/handlers compartidos; las rutas concretas
 * conservan tipado completo vía closures.
 */
export type AnyFastifyInstance = FastifyInstance<any, any, any, any>;
