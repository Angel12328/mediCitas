## MODIFIED Requirements

### Requirement: Consulta de disponibilidad de horarios

El sistema SHALL proveer franjas horarias disponibles para reserva basándose en horarios, soportando consultas por fecha única y por rango de fechas (batch) para el selector de fecha del diálogo.

#### Scenario: Obtener cupos disponibles para fecha única (existente)
- **WHEN** paciente solicita cupos disponibles para doctor/especialidad/fecha via `GET /availability?doctorId=X&specialtyId=Y&date=2026-09-08`
- **THEN** sistema devuelve franjas horarias con capacidad restante: `scheduleId`, `startTime`, `endTime`, `slotCapacity`, `booked`, `available`
- **AND** excluye franjas con `available = 0`

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

### Requirement: Listado de horarios con filtros

El sistema SHALL listar horarios con filtros y paginación, incluyendo `daysBitmask` en response para renderizado semanal en frontend.

#### Scenario: Response incluye daysBitmask para agrupación semanal
- **WHEN** `GET /schedules?doctorId=X&specialtyId=Y`
- **THEN** cada item incluye `daysBitmask` (int) además de campos actuales
- **AND** frontend usa `daysBitmask` para agrupar horarios en WeeklyScheduleList (ej: 31 = "Lunes – Viernes")

## ADDED Requirements

### Requirement: Optimistic lock en Schedule para concurrencia

El sistema SHALL incluir campo `version` en entidad Schedule para soportar bloqueo optimista al reservar cupos.

#### Scenario: Schedule tiene campo version auto-incremental
- **WHEN** se crea o actualiza un Schedule
- **THEN** `version` inicia en 1 e incrementa en cada actualización exitosa
- **WHEN** transacción de reserva valida cupo y actualiza `version`
- **THEN** `WHERE version = valor_leido` previene lost update