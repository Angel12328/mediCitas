// AppError con formato RFC 9457 (Problem Details, antes RFC 7807) - mediCitas API
import { ERROR_CODES, type ErrorCode } from './codes.js';

/**
 * Documento Problem Details (RFC 9457).
 * Miembros obligatorios: type, title, status. Opcionales: detail, instance.
 * Permite miembros de extensión adicionales.
 */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  [extension: string]: unknown;
}

const PROBLEM_BASE_URI = 'https://medicitas.example.com/problems';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly title: string;
  readonly details?: unknown;

  constructor(code: ErrorCode, message?: string, options?: { details?: unknown; cause?: unknown }) {
    const definition = ERROR_CODES[code];
    super(message ?? definition.title, options?.cause ? { cause: options.cause } : undefined);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = definition.status;
    this.title = definition.title;
    this.details = options?.details;
  }

  /**
   * Construye el documento Problem Details para este error.
   * @param instance Identificador URI del recurso afectado (ej. ruta solicitada)
   */
  toProblemDetails(instance?: string): ProblemDetails {
    const problem: ProblemDetails = {
      type: `${PROBLEM_BASE_URI}/${this.code.toLowerCase().replaceAll('_', '-')}`,
      title: this.title,
      status: this.statusCode,
    };
    if (this.message && this.message !== this.title) {
      problem.detail = this.message;
    }
    if (instance) {
      problem.instance = instance;
    }
    if (this.details !== undefined) {
      problem.details = this.details;
    }
    return problem;
  }
}

/** Media type estándar para Problem Details */
export const PROBLEM_JSON_MEDIA_TYPE = 'application/problem+json';
