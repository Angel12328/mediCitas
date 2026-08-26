## Context

Hoy `src/shared/mail/mailer.ts` define `Mailer` con `ConsoleMailer` mock; `auth.service.ts` y `appointment.service.ts` no emiten eventos. Ver `proposal.md - Why`. El esquema Prisma tiene 20 tablas sin `Notification`. API en Fastify 5 + Prisma 7 + Postgres 17.

## Goals / Non-Goals

**Goals:** envío desacoplado vía cola en BD, reintentos con backoff, plantillas, consulta paginada y reintento ADMIN.

**Non-Goals:** SMS/push real (solo diseño extensible), editor visual de plantillas, cola distribuida externa (BullMQ) en esta iteración, tracking de apertura/click.

## Decisions

- **Cola en BD vs BullMQ/Redis**: BD con `Notification(status, scheduledAt, retryCount)` + worker polling cada 60s. Evita infra nueva; suficiente para volumen de clínica única. Alternativa BullMQ descartada por costo operativo; migrable luego detrás de `NotificationQueue` interface.
- **Proveedor email via adaptador**: `EmailProvider.send({to, subject, html, text})` con implementaciones `SmtpProvider` (nodemailer) y `ResendProvider`/`SendGridProvider`; selección por `EMAIL_PROVIDER`. Mock `LogProvider` en `NODE_ENV=test`. Alternativa: acoplar nodemailer directo — menos testeable.
- **Eventos de dominio**: `EventBus` en memoria (pub/sub síncrono en request) que encola `Notification`; no event sourcing completo. Alternativa outbox transaccional — sobreingeniería para MVP.
- **Plantillas Handlebars**: `src/modules/notifications/templates/*.hbs` + `*.text.hbs`; render con contexto tipado `{patient, doctor, appointment, position}`. Alternativa MJML — peso extra.

## Risks / Trade-offs

- **Envío bloquea request si es síncrono** → mitigación: encolar en misma transacción, envío asíncrono por worker; endpoint responde 201 sin esperar envío.
- **Duplicados por reintento** → mitigación: `eventId` único + `UNIQUE(eventId)` y `sentAt` idempotente; recordatorio con `UNIQUE(appointmentId, type)`.
- **Secretos en logs** → mitigación: `EmailProvider` nunca loguea `apiKey`; `NotificationAttempt.error` truncado y sin PII.
- **Polling cada 60s retrasa recordatorio** → mitigación: ventana `reminder_due` ±15min acepta jitter; futuro cron más fino o `LISTEN/NOTIFY`.

## Migration Plan

1. Migración Prisma añade `Notification` y `NotificationAttempt` (FK `userId`, índices `status, scheduledAt`).
2. Deploy con `EMAIL_PROVIDER=log` en dev y `smtp` en prod; worker iniciado en `main.ts` junto a Fastify (graceful shutdown).
3. Rollback: revertir migración (tablas nuevas sin FK críticas) y volver a `ConsoleMailer`; notificaciones `pending` se pierden sin impacto en citas.

## Open Questions

- ¿Proveedor definitivo en prod (SMTP interno vs Resend)? No bloquea — el adaptador lo abstrae.
