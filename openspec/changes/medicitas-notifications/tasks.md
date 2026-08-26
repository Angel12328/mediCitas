## 1. Modelo de datos y migración

- [ ] 1.1 Crear modelos Prisma `Notification` y `NotificationAttempt` con índices `status, scheduledAt` y `UNIQUE(eventId)` y `UNIQUE(appointmentId, type)` para reminder, verificar `npx prisma validate` pasa
- [ ] 1.2 Generar y aplicar migración `npx prisma migrate dev --name notifications`, verificar `npx prisma migrate status` sin drifts
- [ ] 1.3 Seed/ajuste de enums `NotificationType` y `NotificationStatus`, verificar `prisma.notification.count()` tras seed

## 2. Infra de notificaciones

- [ ] 2.1 Implementar `EmailProvider` interface + `SmtpProvider`/`LogProvider` con `send()` y selección por `EMAIL_PROVIDER`, verificar test unitario con `LogProvider` captura `to/subject`
- [ ] 2.2 Implementar `NotificationService.enqueue(eventId, userId, type, payload)` con deduplicación, verificar test concurrente no duplica
- [ ] 2.3 Crear plantillas Handlebars `appointment_confirmation`, `appointment_cancelled`, `appointment_reminder`, `password_reset` (html+text), verificar render incluye doctor/fecha/posición

## 3. Eventos y worker

- [ ] 3.1 Emitir `appointment.created/cancelled` desde `appointment.service.ts` dentro de la transacción que encola notificación, verificar test crea cita y existe `Notification pending`
- [ ] 3.2 Emitir `auth.password_reset_requested` desde `auth.service.ts` en `forgot-password`, verificar test encola `password_reset` sin revelar existencia de email
- [ ] 3.3 Implementar `notification-worker.ts` con polling 60s, backoff exponencial, `maxRetries=5` y `NotificationAttempt` log, verificar test `pending→sent` y `failed→pending` tras reintento
- [ ] 3.4 Job de recordatorio 24h: query `appointments` confirmadas a `24h±15m` y encola `reminder` idempotente, verificar test con fecha mock no duplica

## 4. API de consulta y reintento

- [ ] 4.1 `GET /api/v1/notifications` paginado, solo propias salvo `ADMIN` puede filtrar por `userId`, verificar test BOLA 403 si paciente pide ajenas
- [ ] 4.2 `POST /api/v1/notifications/:id/retry` solo `ADMIN` y solo si `failed`, verificar test cambia a `pending` y worker reprocesa
- [ ] 4.3 Validar rate-limit y RBAC en nuevos endpoints con `helmet`/`rateLimit`, verificar `X-Content-Type-Options` y `429` se preserva

## 5. Integración y despliegue

- [ ] 5.1 Registrar worker en `src/main.ts` con graceful shutdown, añadir `EMAIL_*` a `src/shared/config/env.ts` con Zod, verificar `NODE_ENV=test` usa `LogProvider`
- [ ] 5.2 Añadir suites `tests/notifications/*` y `tests/security` extra para secretos/plantillas sin PII, verificar `npm test` 100% y `npx tsc --noEmit` OK
- [ ] 5.3 Documentar en Swagger bajo tag `notifications` y verificar `GET /docs` lista 2 rutas nuevas; reconstruir `docker build` y `compose up -d` con healthchecks OK
