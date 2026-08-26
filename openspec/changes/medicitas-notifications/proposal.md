## Why

Actualmente `ConsoleMailer` solo loguea en consola; los pacientes no reciben confirmación de cita, recordatorio 24h antes ni aviso de cancelación, lo que aumenta no-shows. El flujo `forgot-password` tampoco envía email real. Se necesita un sistema de notificaciones desacoplado, trazable y reintentable que cierre el ciclo de `appointments/booking`.

## What Changes

- Reemplaza `ConsoleMailer` por `NotificationService` con adaptador `EmailProvider` (SMTP/SendGrid/Resend configurable por env, fallback a log en dev).
- Crea tablas `Notification` y `NotificationAttempt` (evento, destinatario, canal, estado, reintentos) y cola en BD con job periódico.
- Emite eventos de dominio `appointment.created`, `appointment.cancelled`, `appointment.reminder_due` y `auth.password_reset_requested`; un worker los convierte en notificaciones.
- Expone `GET /api/v1/notifications` (propias, paginadas, filtradas por estado) y `POST /api/v1/notifications/:id/retry` (ADMIN).
- Envía plantillas HTML/texto para confirmación, cancelación, recordatorio 24h y restablecimiento de contraseña.
- **BREAKING**: `DATABASE_URL` requiere migración; `EMAIL_PROVIDER`, `EMAIL_FROM`, `EMAIL_API_KEY` nuevas env vars (con defaults dev).

## Capabilities

### New Capabilities
- `notifications/delivery`: Creación, encolado, envío, reintento y consulta de notificaciones por canal email (extensible a SMS/push).

### Modified Capabilities
- `appointments/booking`: Añade efectos observables de notificación al crear/cancelar cita y al vencer recordatorio 24h antes; no cambia reglas de reserva/cupo/posición.

## Impact

- **Código**: nuevo módulo `src/modules/notifications/*`, migración Prisma, worker `src/jobs/notification-worker.ts`, plantillas `src/modules/notifications/templates/*`, cambios en `src/modules/appointments/appointment.service.ts` y `src/modules/auth/auth.service.ts` para emitir eventos.
- **APIs**: 2 endpoints nuevos bajo `/api/v1/notifications`; sin cambios breaking en contratos existentes.
- **Dependencias**: `nodemailer` o SDK del proveedor + `handlebars` para plantillas; opcional `pg-boss`/`bullmq` si se migra cola fuera de BD más adelante.
- **Sistemas**: requiere credenciales SMTP/API en producción y cron del worker (intervalo 1 min).
