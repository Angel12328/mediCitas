// Composición de la aplicación Fastify - mediCitas API
import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { Mailer } from './shared/mail/mailer.js';
import { ConsoleMailer } from './shared/mail/mailer.js';
import { logger } from './shared/logging/logger.js';
import { registerErrorHandler } from './shared/errors/handler.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { userProfileRoutes } from './modules/users/user.routes.js';
import { userAdminRoutes } from './modules/users/user-admin.routes.js';
import { locationRoutes } from './modules/locations/location.routes.js';
import { cargoRoutes } from './modules/employees/cargo.routes.js';
import { employeeRoutes } from './modules/employees/employee.routes.js';
import { specialtyRoutes } from './modules/doctors/specialty.routes.js';
import { doctorRoutes } from './modules/doctors/doctor.routes.js';
import { scheduleRoutes } from './modules/doctors/schedule.routes.js';
import { patientProfileRoutes } from './modules/patients/patient.routes.js';
import { extensionRoutes } from './modules/contacts/extension.routes.js';
import { phoneRoutes } from './modules/contacts/phone.routes.js';
import { appointmentRoutes } from './modules/appointments/appointment.routes.js';

export interface BuildAppOptions {
  mailer?: Mailer;
  /** Exponer /docs y /docs/json (por defecto true; desactivar en producción) */
  enableDocs?: boolean;
  /** Límite global de peticiones por minuto por IP */
  rateLimitMax?: number;
  /** Límite estricto para endpoints de autenticación (anti fuerza bruta) */
  authRateLimitMax?: number;
}

// El tipo concreto se infiere para conservar los genéricos del logger personalizado
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- retorno inferido
export function buildApp(options: BuildAppOptions = {}) {
  const {
    mailer = new ConsoleMailer(),
    enableDocs = true,
    rateLimitMax = 300,
    authRateLimitMax = 10,
  } = options;

  const app = Fastify({
    loggerInstance: logger,
    trustProxy: true,
  });

  // Cabeceras de seguridad (OWASP Secure Headers)
  app.register(helmet);

  // Rate limiting global anti abuso/fuerza bruta.
  // Las rutas de login/registro aplican un presupuesto estricto adicional
  // vía el decorador `rateLimit` dentro de su propio plugin.
  app.register(rateLimit, {
    global: true,
    max: rateLimitMax,
    timeWindow: '1 minute',
  });

  registerErrorHandler(app);

  // Documentación OpenAPI/Swagger: solo en desarrollo o si se habilita
  if (enableDocs) {
    app.register(swagger, {
      openapi: {
        info: {
          title: 'mediCitas API',
          description:
            'API de gestión de citas médicas: usuarios, pacientes, doctores, horarios y citas.',
          version: '0.1.0',
        },
        servers: [{ url: 'http://localhost:3000', description: 'Desarrollo local' }],
        tags: [
          { name: 'auth', description: 'Autenticación y sesión' },
          { name: 'users', description: 'Usuarios y roles' },
          { name: 'locations', description: 'Ubicaciones' },
          { name: 'employees', description: 'Empleados y cargos' },
          { name: 'doctors', description: 'Doctores, especialidades y horarios' },
          { name: 'patients', description: 'Pacientes' },
          { name: 'contacts', description: 'Teléfonos y extensiones' },
          { name: 'appointments', description: 'Citas médicas' },
        ],
      },
    });
    app.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: { docExpansion: 'none', deepLinking: true },
    });
  }

  // /health en sub-plugin para que Swagger lo incluya en el spec
  app.register(async function healthRoutes(instance) {
    instance.get('/health', async () => ({ status: 'ok' }));
  });

  app.register(authRoutes, {
    prefix: '/api/v1/auth',
    mailer,
    authRateLimitMax,
  });
  app.register(userProfileRoutes, { prefix: '/api/v1/users' });
  app.register(userAdminRoutes, { prefix: '/api/v1' });
  app.register(locationRoutes, { prefix: '/api/v1' });
  app.register(cargoRoutes, { prefix: '/api/v1/cargos' });
  app.register(employeeRoutes, { prefix: '/api/v1/employees' });
  app.register(specialtyRoutes, { prefix: '/api/v1/specialties' });
  app.register(doctorRoutes, { prefix: '/api/v1/doctors' });
  app.register(scheduleRoutes, { prefix: '/api/v1/schedules' });
  app.register(patientProfileRoutes, { prefix: '/api/v1/patients' });
  app.register(extensionRoutes, { prefix: '/api/v1/extensions' });
  app.register(phoneRoutes, { prefix: '/api/v1/phones' });
  app.register(appointmentRoutes, { prefix: '/api/v1/appointments' });

  return app;
}
