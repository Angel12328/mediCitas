## Purpose

Define la creación de citas de seguimiento (follow-up) como operación independiente que genera una nueva cita PENDING preservando la cita original completada, reutilizando validaciones de reserva existentes.

## ADDED Requirements

### Requirement: Endpoint para crear cita de seguimiento
El sistema SHALL exponer endpoint `POST /api/v1/appointments/follow-up` que crea nueva cita de control a partir de referencia a cita original completada.

#### Scenario: Crear cita de control exitosa
- **WHEN** doctor autenticado envía patientId, scheduleId, date y originalAppointmentId opcional
- **THEN** sistema crea cita con estado PENDING, asigna posición en cola, devuelve datos de nueva cita con código 201

#### Scenario: Rechaza si cita original no está COMPLETED
- **WHEN** originalAppointmentId referencia cita que no está COMPLETED
- **THEN** sistema rechaza con error VALIDATION_ERROR

#### Scenario: Rechaza si paciente no coincide
- **WHEN** patientId no coincide con paciente de cita original
- **THEN** sistema rechaza con error VALIDATION_ERROR

#### Scenario: Valida horario activo y día correcto
- **WHEN** scheduleId no existe, está inactivo, o no atiende el día solicitado
- **THEN** sistema rechaza con error NOT_FOUND o VALIDATION_ERROR

#### Scenario: Valida cupo disponible
- **WHEN** horario ya tiene cupos ocupados igual a capacidad
- **THEN** sistema rechaza con error CONFLICT

#### Scenario: Valida sin solapamiento paciente mismo día
- **WHEN** paciente ya tiene cita que se solapa en horario en la fecha solicitada
- **THEN** sistema rechaza con error OVERLAP_CONFLICT

#### Scenario: Valida ventana de antelación 2h–60d
- **WHEN** fecha está a menos de 2 horas o más de 60 días
- **THEN** sistema rechaza con error INVALID_ADVANCE

### Requirement: Cita original permanece inalterada
El sistema SHALL mantener la cita original en estado COMPLETED sin modificaciones al crear cita de seguimiento.

#### Scenario: Cita original no cambia tras seguimiento
- **WHEN** se crea cita de control desde cita COMPLETED
- **THEN** cita original conserva estado COMPLETED, posición, observaciones, y referencias intactas

#### Scenario: No se libera cupo en horario original
- **WHEN** cita original ya estaba COMPLETED (cupo ya liberado por transición CONFIRMED→COMPLETED)
- **THEN** sistema no modifica versión ni cupos del horario original

### Requirement: Copia opcional de observaciones clínicas
El sistema SHALL copiar observaciones de la cita original a la nueva cita de control cuando se proporciona originalAppointmentId.

#### Scenario: Observaciones se copian a nueva cita
- **WHEN** cita original tiene observaciones y se crea seguimiento
- **THEN** nueva cita incluye observación prefixada con "Control: " seguida de observación original

#### Scenario: Sin observaciones si original no las tiene
- **WHEN** cita original no tiene observaciones
- **THEN** nueva cita se crea sin observación (o solo "Control post-consulta")

### Requirement: Reutiliza lógica de reserva con bloqueo optimista
El sistema SHALL aplicar las mismas validaciones y mecanismo de reserva (bloqueo optimista en Schedule.version) que la reserva normal de paciente.

#### Scenario: Concurrencia manejada con reintentos
- **WHEN** múltiples doctores intentan agendar en mismo cupo simultáneamente
- **THEN** sistema usa bloqueo optimista en Schedule.version y reintenta hasta 3 veces

#### Scenario: Posición en cola asignada correctamente
- **WHEN** nueva cita se crea en horario con citas existentes
- **THEN** posición = max(posiciones existentes no eliminadas) + 1