// AppError con formato RFC 9457 (Problem Details, antes RFC 7807) - mediCitas API
import { ERROR_CODES } from './codes.js';
const PROBLEM_BASE_URI = 'https://medicitas.example.com/problems';
export class AppError extends Error {
    code;
    statusCode;
    title;
    details;
    constructor(code, message, options) {
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
    toProblemDetails(instance) {
        const problem = {
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
//# sourceMappingURL=app-error.js.map