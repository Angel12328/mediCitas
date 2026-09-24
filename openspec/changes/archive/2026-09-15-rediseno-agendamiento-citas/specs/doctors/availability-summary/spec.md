## Purpose

Provee un endpoint enriquecido para listar doctores de una especialidad con resumen agregado de disponibilidad (próxima fecha con cupo, totales mes, flags semanales) permitiendo filtros y ordenamiento server-side sin N+1 requests desde el frontend.

## ADDED Requirements

### Requirement: Lista de doctores con resumen de disponibilidad

El sistema SHALL extender `GET /doctors` con parámetros opcionales `withAvailability=true` y `daysAhead=N` que añaden a cada doctor un objeto `availabilitySummary` con disponibilidad agregada.

#### Scenario: Request con withAvailability=true devuelve summary
- **WHEN** `GET /doctors?specialtyId=cardio&withAvailability=true&daysAhead=30`
- **THEN** response incluye por cada doctor:
  - `availabilitySummary.hasAvailabilityThisWeek: boolean` — true si existe cupo en próximos 7 días
  - `availabilitySummary.hasAvailabilityThisMonth: boolean` — true si existe cupo en próximos 30 días
  - `availabilitySummary.nextAvailableDate: string|null` — primera fecha con cupo (ISO YYYY-MM-DD)
  - `availabilitySummary.nextSlot: {scheduleId, startTime, endTime, available, total}|null` — detalle del próximo slot con cupo
  - `availabilitySummary.totalSlotsThisMonth: number` — total slots (días × franjas) en ventana
  - `availabilitySummary.totalAvailableThisMonth: number` — suma de `available` en ventana

#### Scenario: Request sin withAvailability mantiene respuesta original
- **WHEN** `GET /doctors?specialtyId=cardio` (sin withAvailability)
- **THEN** response es idéntica a actual (sin `availabilitySummary`)

#### Scenario: Doctor sin horarios activos tiene summary vacío
- **WHEN** doctor no tiene schedules `ACTIVE` para la especialidad
- **THEN** `availabilitySummary` tiene `hasAvailabilityThisWeek=false`, `hasAvailabilityThisMonth=false`, `nextAvailableDate=null`, `nextSlot=null`, totales en 0

### Requirement: Ordenamiento y filtrado server-side por disponibilidad

El sistema SHALL soportar parámetros `sort=availability` y `filter=hasAvailabilityThisWeek` para ordenar y filtrar la lista antes de paginar.

#### Scenario: sort=availability pone doctores con cupo primero
- **WHEN** `GET /doctors?specialtyId=cardio&withAvailability=true&sort=availability`
- **THEN** items ordenados: `hasAvailabilityThisWeek=true` primero, luego `hasAvailabilityThisMonth=true`, luego sin cupo; dentro de cada grupo alfabético por `fullName`

#### Scenario: filter=hasAvailabilityThisWeek oculta sin cupo esta semana
- **WHEN** `GET /doctors?specialtyId=cardio&withAvailability=true&filter=hasAvailabilityThisWeek`
- **THEN** response solo incluye doctores con `hasAvailabilityThisWeek=true`
- **AND** paginación (`page`, `pageSize`, `total`, `totalPages`) refleja solo items filtrados

#### Scenario: Combinación sort + filter + paginación
- **WHEN** `GET /doctors?specialtyId=cardio&withAvailability=true&filter=hasAvailabilityThisWeek&sort=availability&page=1&pageSize=10`
- **THEN** página 1 muestra primeros 10 doctores con cupo esta semana, ordenados por disponibilidad

### Requirement: Cálculo de availabilitySummary consistente con /availability

El sistema SHALL calcular `availabilitySummary` usando la misma lógica de cupos que `/schedules/availability` (excluye `CANCELLED`/`NO_SHOW`, respeta `daysBitmask`, `slotCapacity`).

#### Scenario: nextAvailableDate coincide con primera fecha disponible en /availability
- **WHEN** `availabilitySummary.nextAvailableDate = "2026-09-08"`
- **THEN** `GET /schedules/availability?doctorId=X&specialtyId=Y&date=2026-09-08` retorna al menos un item con `available > 0`

#### Scenario: hasAvailabilityThisWeek=true implica al menos un día en próximos 7 con cupo
- **WHEN** `hasAvailabilityThisWeek=true`
- **THEN** existe al menos una fecha en `[hoy, hoy+7 días)` donde `/availability` retorna `available > 0` para ese doctor/especialidad