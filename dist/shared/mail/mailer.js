// Interfaz de envío de correo con implementación mock - mediCitas API
// El servicio real (SMTP/API) se integrará en una fase posterior.
/** Mailer mock: registra en consola (visible en logs JSON). */
export class ConsoleMailer {
    async sendPasswordResetEmail(to, _resetToken) {
        // En producción esto lo reemplaza un proveedor real; nunca loguear tokens reales
        // eslint-disable-next-line no-console -- implementación mock deliberada
        console.info(JSON.stringify({
            mail: 'password-reset',
            to,
            previewUrl: '/reset-password?token=<redacted>',
        }));
    }
}
//# sourceMappingURL=mailer.js.map