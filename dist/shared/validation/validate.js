import { AppError } from '../errors/app-error.js';
/**
 * Crea un hook preValidation que valida y reemplaza las partes
 * especificadas del request (body/query/params) con datos parseados.
 * Lanza AppError(VALIDATION_ERROR) con los issues de Zod si falla.
 */
export function validate(schemas) {
    return async function validationHook(request) {
        const parts = ['body', 'query', 'params'];
        for (const part of parts) {
            const schema = schemas[part];
            if (!schema)
                continue;
            const result = schema.safeParse(request[part]);
            if (!result.success) {
                throw new AppError('VALIDATION_ERROR', `Datos inválidos en '${part}'`, {
                    details: result.error.issues.map((issue) => ({
                        field: issue.path.join('.') || '(raíz)',
                        message: issue.message,
                        code: issue.code,
                    })),
                });
            }
            // Asignación segura: body/query/params son propiedades mutables en Fastify
            Object.assign(request, { [part]: result.data });
        }
    };
}
//# sourceMappingURL=validate.js.map