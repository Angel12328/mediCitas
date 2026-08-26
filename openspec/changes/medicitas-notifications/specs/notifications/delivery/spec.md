## Purpose

Permite notificar por email (extensible a SMS/push) eventos del sistema de citas y autenticación, con trazabilidad, reintentos y consulta por usuario, desacoplando el envío del flujo principal.

## ADDED Requirements

### Requirement: Encolado de notificaciones por eventos de dominio

El sistema SHALL encolar una notificación cuando ocurran eventos `appointment.created`, `appointment.cancelled`, `appointment.reminder_due` y `auth.password_reset_requested`.

#### Scenario: Cita creada genera confirmación
- **WHEN** se crea una cita en estado `confirmada`
- **THEN** el sistema encola una notificación `channel=email`, `type=appointment_confirmation` para el paciente, con `status=pending`

#### Scenario: Solicitud de restablecimiento encola email
- **WHEN** se solicita `POST /api/v1/auth/forgot-password` con email válido
- **THEN** el sistema encola `type=password_reset` para ese usuario sin revelar si el email existe (respuesta 200 idempotente)

#### Scenario: Idempotencia por evento
- **WHEN** el mismo evento se emite dos veces con igual `eventId`
- **THEN** el sistema crea solo una notificación (deduplicación por `eventId`)

### Requirement: Envío con reintentos y trazabilidad

El sistema SHALL intentar enviar notificaciones `pending` mediante el `EmailProvider` configurado, registrando cada intento y reintentando con backoff.

#### Scenario: Envío exitoso
- **WHEN** el worker procesa una notificación `pending` y el proveedor responde 2xx
- **THEN** la notificación pasa a `sent` y se registra un `NotificationAttempt` con `status=sent`

#### Scenario: Fallo transitorio con reintento
- **WHEN** el proveedor responde error 5xx o timeout
- **THEN** el intento se registra como `failed`, `retryCount` incrementa y la notificación vuelve a `pending` hasta `maxRetries=5` con backoff exponencial

#### Scenario: Fallo definitivo
- **WHEN** se superan `maxRetries`
- **THEN** la notificación pasa a `failed` y no se reintenta automáticamente

### Requirement: Consulta y reintento manual

El sistema SHALL permitir consultar notificaciones propias y a ADMIN reintentar fallidas.

#### Scenario: Paciente consulta sus notificaciones
- **WHEN** usuario autenticado hace `GET /api/v1/notifications?status=sent`
- **THEN** recibe solo sus notificaciones paginadas, ordenadas por `createdAt` descendente

#### Scenario: ADMIN reintenta fallida
- **WHEN** ADMIN hace `POST /api/v1/notifications/:id/retry` sobre una notificación `failed`
- **THEN** la notificación vuelve a `pending` y el worker la reprocesa

#### Scenario: Usuario no autorizado no ve notificaciones ajenas
- **WHEN** usuario intenta `GET /api/v1/notifications` de otro usuario (query con `userId` ajeno)
- **THEN** el sistema responde `403` o filtra a solo propias

### Requirement: Plantillas y contenido

El sistema SHALL renderizar asunto y cuerpo desde plantillas versionadas por `type`.

#### Scenario: Confirmación contiene datos de la cita
- **WHEN** se envía `appointment_confirmation`
- **THEN** el email incluye doctor, especialidad, fecha, hora, posición y enlace de cancelación, en HTML y texto plano

#### Scenario: Recordatorio 24h antes
- **WHEN** una cita confirmada está a 24h ±15min de su horario
- **THEN** el worker encola y envía `appointment_reminder` una sola vez por cita

### Requirement: Configuración y privacidad

El sistema SHALL usar `EMAIL_FROM`, `EMAIL_PROVIDER` y no exponer secretos en logs o respuestas; el contenido de la notificación solo es visible a su destinatario y a ADMIN.

#### Scenario: Secreto no filtrado
- **WHEN** el envío falla y se registra el error
- **THEN** el log/attempt no contiene `EMAIL_API_KEY` ni cuerpo completo con PII más allá del mínimo necesario
