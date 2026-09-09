// Códigos de error de la aplicación - mediCitas API
// Cada código define su estado HTTP y título por defecto (RFC 9457).
export const ERROR_CODES = {
    VALIDATION_ERROR: { status: 400, title: 'La solicitud contiene datos inválidos' },
    UNAUTHORIZED: { status: 401, title: 'No autenticado' },
    FORBIDDEN: { status: 403, title: 'Acceso denegado' },
    NOT_FOUND: { status: 404, title: 'Recurso no encontrado' },
    CONFLICT: { status: 409, title: 'Conflicto con el estado actual del recurso' },
    UNPROCESSABLE: { status: 422, title: 'No se puede procesar la solicitud' },
    INTERNAL_ERROR: { status: 500, title: 'Error interno del servidor' },
    // Nuevos códigos para validaciones de agendamiento
    CONCURRENT_BOOKING: { status: 409, title: 'Conflicto de concurrencia al reservar' },
    OVERLAP_CONFLICT: { status: 409, title: 'La cita se solapa con otra existente' },
    INVALID_ADVANCE: { status: 400, title: 'Fuera de ventana de antelación permitida' },
    DAILY_LIMIT_EXCEEDED: { status: 409, title: 'Límite diario de citas excedido' },
    WEEKLY_LIMIT_EXCEEDED: { status: 409, title: 'Límite semanal de citas excedido' },
    DUPLICATE_APPOINTMENT: { status: 409, title: 'Cita duplicada para ese horario y fecha' },
};
//# sourceMappingURL=codes.js.map