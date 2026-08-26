/**
 * Errores de la API y su mapeo a mensajes de usuario - mediCitas web
 * Espeja los códigos de src/shared/errors/codes.ts del backend (RFC 9457).
 */

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNPROCESSABLE"
  | "INTERNAL_ERROR";

export interface ProblemDetails {
  type?: string;
  title?: string;
  /** Mensaje específico del backend (RFC 9457 detail) */
  detail?: string;
  status?: number;
  instance?: string;
  code?: ApiErrorCode;
  details?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | undefined;
  readonly title: string;
  readonly details: unknown;
  /** Mensaje específico (detail RFC 9457) cuando difiere del título */
  specificMessage?: string;

  constructor(status: number, code: ApiErrorCode | undefined, title: string, details?: unknown) {
    super(title);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.title = title;
    this.details = details;
  }

  /** El mensaje más específico disponible para el usuario */
  get userFacingDetail(): string {
    return this.specificMessage ?? this.message;
  }
}

/** Mensajes amigables por código de error del backend */
export const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  VALIDATION_ERROR: "Revisa los datos ingresados.",
  UNAUTHORIZED: "Correo o contraseña incorrectos.",
  FORBIDDEN: "No tienes permiso para realizar esta acción.",
  NOT_FOUND: "No encontramos lo que buscabas.",
  CONFLICT: "El recurso ya existe o está en uso.",
  UNPROCESSABLE: "No se pudo completar la operación.",
  INTERNAL_ERROR: "Ocurrió un error interno. Intenta de nuevo más tarde.",
};

/** Mensaje por estado HTTP cuando el cuerpo no trae código conocido */
const STATUS_FALLBACK: Record<number, string> = {
  400: ERROR_MESSAGES.VALIDATION_ERROR,
  401: ERROR_MESSAGES.UNAUTHORIZED,
  403: ERROR_MESSAGES.FORBIDDEN,
  404: ERROR_MESSAGES.NOT_FOUND,
  409: ERROR_MESSAGES.CONFLICT,
  422: ERROR_MESSAGES.UNPROCESSABLE,
  429: "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
};

/** Convierte una respuesta problem+json en ApiError */
export function apiErrorFromResponse(status: number, body: unknown): ApiError {
  const problem = (body ?? {}) as ProblemDetails;
  const code = isApiErrorCode(problem.code) ? problem.code : undefined;
  const specific =
    typeof problem.detail === "string" && problem.detail.length > 0
      ? problem.detail
      : undefined;
  const title =
    typeof problem.title === "string" && problem.title.length > 0
      ? problem.title
      : specific ||
        (code && ERROR_MESSAGES[code]) ||
        "Error inesperado";
  const err = new ApiError(status, code, title, problem.details);
  if (specific && title !== specific) err.specificMessage = specific;
  return err;
}

/** Mensaje listo para mostrar al usuario */
export function userMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code && ERROR_MESSAGES[error.code]) return ERROR_MESSAGES[error.code];
    if (STATUS_FALLBACK[error.status]) return STATUS_FALLBACK[error.status];
    return error.message;
  }
  if (error instanceof TypeError) {
    // fetch lanza TypeError ante red caída/CORS
    return "No hay conexión con el servidor. Verifica tu conexión.";
  }
  return "Ocurrió un error inesperado.";
}

function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(ERROR_MESSAGES, value)
  );
}
