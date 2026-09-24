# doctors/schedules Specification

## Purpose

Gestiona horarios de disponibilidad de doctores por especialidad con franjas horarias, capacidad y patrones de recurrencia para reserva de citas.

## Requirements

### Requirement: Creación de horarios
El sistema SHALL crear horarios recurrentes para doctores por especialidad con días, horas y capacidad.

#### Scenario: Crear horario semanal
- **WHEN** admin crea horario para doctor/especialidad con días, horas inicio/fin y capacidad de cupos
- **THEN** sistema crea registro de horario con parámetros especificados

#### Scenario: Validar conflictos de horario
- **WHEN** creando horario que se superpone con horario existente para mismo doctor/especialidad
- **THEN** sistema rechaza con error de conflicto

### Requirement: Consulta de disponibilidad de horarios
El sistema SHALL proveer franjas horarias disponibles para reserva basándose en horarios, soportando consultas por fecha única y por rango de fechas (batch) para el selector de fecha del diálogo.

#### Scenario: Obtener cupos disponibles
- **WHEN** paciente solicita cupos disponibles para doctor/especialidad/fecha via `GET /availability?doctorId=X&specialtyId=Y&date=2026-09-08`
- **THEN** sistema devuelve franjas horarias con capacidad restante: `scheduleId`, `startTime`, `endTime`, `slotCapacity`, `booked`, `available`
- **AND** excluye franjas con `available = 0`

#### Scenario: Excluir cupos reservados
- **WHEN** cupos están completamente reservados
- **THEN** sistema los excluye de resultados disponibles

#### Scenario: Obtener cupos disponibles para rango de fechas (batch) — NUEVO
- **WHEN** frontend solicita disponibilidad para un mes via `GET /availability?doctorId=X&specialtyId=Y&scheduleId=Z&startDate=2026-09-01&endDate=2026-09-30`
- **THEN** sistema devuelve array de items por fecha: `[{ date, scheduleId, startTime, endTime, slotCapacity, booked, available }]`
- **AND** solo incluye fechas donde `daysBitmask` del schedule coincide con día de la semana
- **AND** excluye fechas pasadas
- **AND** response incluye `daysBitmask` del schedule para que frontend sepa qué días atiende

#### Scenario: Batch response usado por DatePickerWithAvailability
- **WHEN** paciente navega mes en grid del selector de fecha
- **THEN** frontend llama batch para ese mes y `scheduleId`
- **THEN** grid marca días con `available>0` = bold, `available=0` = normal, días sin horario = disabled
- **THEN** lista vertical muestra cupos reales por fecha

### Requirement: Modificación de horarios
El sistema SHALL permitir modificación de parámetros de horarios.

#### Scenario: Actualizar horas de horario
- **WHEN** admin actualiza horas o días de horario
- **THEN** sistema actualiza horario y disponibilidad futura refleja cambios

#### Scenario: Desactivar horario
- **WHEN** admin desactiva horario
- **THEN** horario ya no genera cupos disponibles pero citas existentes se preservan

### Requirement: Observaciones de horarios
El sistema SHALL soportar notas/observaciones opcionales en horarios.

#### Scenario: Agregar observación a horario
- **WHEN** admin agrega observación a horario
- **THEN** observación almacenada y visible en detalles de horario

### Requirement: Optimistic lock en Schedule para concurrencia

El sistema SHALL incluir campo `version` en entidad Schedule para soportar bloqueo optimista al reservar cupos.

#### Scenario: Schedule tiene campo version auto-incremental
- **WHEN** se crea o actualiza un Schedule
- **THEN** `version` inicia en 1 e incrementa en cada actualización exitosa
- **WHEN** transacción de reserva valida cupo y actualiza `version`
- **THEN** `WHERE version = valor_leido` previene lost update
