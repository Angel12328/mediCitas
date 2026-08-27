// Servicio de hash de contraseñas con Argon2id - mediCitas API
import { hash, verify } from '@node-rs/argon2';
// Parámetros OWASP-recomendados para Argon2id
const ARGON2_OPTIONS = {
    memoryCost: 19456, // KiB (19 MiB)
    timeCost: 2,
    parallelism: 1,
};
export async function hashPassword(plainPassword) {
    return hash(plainPassword, ARGON2_OPTIONS);
}
/**
 * Verifica una contraseña contra su hash.
 * Nunca lanza por contraseña incorrecta: devuelve false.
 */
export async function verifyPassword(passwordHash, plainPassword) {
    try {
        return await verify(passwordHash, plainPassword);
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=password.service.js.map