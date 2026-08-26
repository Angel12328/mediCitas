// Códigos de error de la aplicación - mediCitas API
// Cada código define su estado HTTP y título por defecto (RFC 9457).

export interface ErrorCodeDefinition {
  status: number;
  title: string;
}

export const ERROR_CODES = {
  VALIDATION_ERROR: { status: 400, title: 'La solicitud contiene datos inválidos' },
  UNAUTHORIZED: { status: 401, title: 'No autenticado' },
  FORBIDDEN: { status: 403, title: 'Acceso denegado' },
  NOT_FOUND: { status: 404, title: 'Recurso no encontrado' },
  CONFLICT: { status: 409, title: 'Conflicto con el estado actual del recurso' },
  UNPROCESSABLE: { status: 422, title: 'No se puede procesar la solicitud' },
  INTERNAL_ERROR: { status: 500, title: 'Error interno del servidor' },
} as const satisfies Record<string, ErrorCodeDefinition>;

export type ErrorCode = keyof typeof ERROR_CODES;
