import { ConsoleMailer } from '../../shared/mail/mailer.js';
import { authenticate } from '../../shared/auth/guards.js';
import { validate } from '../../shared/validation/validate.js';
import { changePasswordSchema, forgotPasswordSchema, loginSchema, refreshSchema, registerSchema, resetPasswordSchema, } from './auth.schemas.js';
import { changePassword, loginUser, registerUser, requestPasswordReset, resetPassword, } from './auth.service.js';
import { revokeRefreshToken, rotateRefreshToken } from './session.service.js';
import { signAccessToken } from './token.service.js';
import { prisma } from '../../shared/database/client.js';
export async function authRoutes(app, opts) {
    const mailer = opts.mailer ?? new ConsoleMailer();
    // Presupuesto propio por ruta (leído por @fastify/rate-limit global)
    const authRateConfig = {
        rateLimit: { max: opts.authRateLimitMax ?? 10, timeWindow: '1 minute' },
    };
    // Registro público: persona + usuario + enlace paciente/empleado + tokens
    app.post('/register', {
        preHandler: validate({ body: registerSchema }),
        config: authRateConfig,
    }, async (request, reply) => {
        const result = await registerUser(request.body);
        reply.status(201);
        return {
            user: result.user,
            accessToken: result.tokens.accessToken,
            refreshToken: result.tokens.refreshToken,
        };
    });
    // Login con credenciales
    app.post('/login', {
        preHandler: validate({ body: loginSchema }),
        config: authRateConfig,
    }, async (request) => {
        const { email, password } = request.body;
        const result = await loginUser(email, password);
        return {
            user: result.user,
            accessToken: result.tokens.accessToken,
            refreshToken: result.tokens.refreshToken,
        };
    });
    // Rotación de refresh token
    app.post('/refresh', { preHandler: validate({ body: refreshSchema }) }, async (request) => {
        const { refreshToken } = request.body;
        const rotation = await rotateRefreshToken(refreshToken);
        const assignments = await prisma.userRole.findMany({
            where: { userId: rotation.user.id, status: 'ACTIVE', deletedAt: null },
            include: { role: { select: { name: true } } },
        });
        const roleNames = assignments.map((a) => a.role.name);
        return {
            accessToken: signAccessToken({ sub: rotation.user.id, roles: roleNames }),
            refreshToken: rotation.refreshToken,
        };
    });
    // Logout: revoca el refresh token recibido
    app.post('/logout', { preHandler: validate({ body: refreshSchema }) }, async (request, reply) => {
        const { refreshToken } = request.body;
        await revokeRefreshToken(refreshToken);
        reply.status(204);
        return null;
    });
    // Cambio de contraseña (autenticado); revoca todas las sesiones
    app.post('/change-password', { preHandler: [authenticate, validate({ body: changePasswordSchema })] }, async (request, reply) => {
        const userId = request.user.id;
        const { currentPassword, newPassword } = request.body;
        await changePassword(userId, currentPassword, newPassword);
        reply.status(204);
        return null;
    });
    // Solicitud de restablecimiento (público; anti-enumeración)
    app.post('/forgot-password', { preHandler: validate({ body: forgotPasswordSchema }) }, async (request) => {
        const { email } = request.body;
        await requestPasswordReset(email, mailer);
        return {
            message: 'Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.',
        };
    });
    // Confirmación de restablecimiento (público)
    app.post('/reset-password', { preHandler: validate({ body: resetPasswordSchema }) }, async (request, reply) => {
        const { token, newPassword } = request.body;
        await resetPassword(token, newPassword);
        reply.status(204);
        return null;
    });
}
//# sourceMappingURL=auth.routes.js.map