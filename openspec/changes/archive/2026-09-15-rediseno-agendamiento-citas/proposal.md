## Why

El flujo actual de agendamiento (4 pasos: especialidad → doctor → calendario → horarios) tiene fricción alta: el paciente no ve la agenda semanal del doctor hasta haber seleccionado uno, y el calendario muestra todas las fechas bloqueadas si no hay doctor seleccionado. Además, faltan validaciones críticas de concurrencia, solape de horarios y límites por paciente.

Este rediseño simplifica a 3 pasos (especialidad → doctor → diálogo agenda semanal + selector fecha → confirmar), muestra disponibilidad real en la card del doctor, y agrega reglas de negocio robustas para evitar overbooking, citas duplicadas y acaparamiento de cupos.

## What Changes

- **BREAKING**: Flujo UI de agendamiento: elimina `MonthCalendar` standalone y panel de horarios lateral; introduce `ScheduleDialog` con vista semanal (lista agrupada por días) + selector de fecha (grid mes + lista cupos)
- **BREAKING**: `DoctorCard` ya no muestra "Próximo: HH-HH · N cupos"; muestra resumen semanal "Lun-Vie 08-12, 14-17 | Sáb 09-13" + botón `[Ver agenda]`
- **NEW**: Validaciones de agendamiento: optimistic lock en `Schedule.version` + retry, bloqueo overlap mismo día, ventana 2h-60d, límites 1/día 2/sem + excepción admin
- **NEW**: Endpoint enriquecido `/doctors?withAvailability=true&daysAhead=30` para listar doctores con resumen de disponibilidad (Fase 2, diseñado ahora)
- **MODIFIED**: `appointments/booking` spec — flujo UI, criterios de validación, comportamiento de cards
- **MODIFIED**: `doctors/schedules` spec — endpoint availability soporta batch por mes para selector fecha
- **REMOVED**: `useAvailabilityByDateRange` hook (reemplazado por `useDoctorSchedules` + fetch on-demand)
- **REMOVED**: `MonthCalendar` component (ya no se usa en wizard)

## Capabilities

### New Capabilities

- `appointments/validation`: Reglas de negocio para creación de citas (optimistic lock, overlap, ventana antelación, límites paciente, idempotencia)
- `doctors/availability-summary`: Endpoint enriquecido que devuelve lista de doctores con `availabilitySummary` (próxima fecha, cupos, totales mes) para filtros/ordenamiento server-side
- `web/appointments/booking-wizard`: Componentes UI del nuevo wizard (ScheduleDialog, WeeklyScheduleList, DatePickerWithAvailability, DoctorCardV2)

### Modified Capabilities

- `appointments/booking`: Cambia flujo de 4 a 3 pasos, elimina calendario standalone, agrega validaciones nuevas, modifica card de doctor
- `doctors/schedules`: Extiende `/availability` con query opcional `startDate`/`endDate` para batch por mes; añade `daysBitmask` en response para renderizado semanal

## Impact

**Backend (API):**
- `src/modules/appointments/appointment.service.ts` — nueva lógica validación + optimistic lock
- `src/modules/doctors/schedule.routes.ts` — endpoint `/availability` acepta `startDate`/`endDate`
- `src/modules/doctors/doctor.routes.ts` — nuevo query param `withAvailability` en `/doctors`
- Prisma: migración añade `version` a `Schedule` model

**Frontend (Web):**
- `web/src/modules/appointments/components/agendar-wizard.tsx` — reescritura completa
- `web/src/modules/appointments/components/doctor-card.tsx` — nuevo prop `schedules`, resumen semanal
- `web/src/modules/appointments/components/month-calendar.tsx` — **eliminado** (o archivado)
- `web/src/modules/appointments/hooks/use-availability-by-date-range.ts` — **eliminado**
- `web/src/modules/appointments/hooks/use-doctor-schedules.ts` — **nuevo**
- `web/src/modules/appointments/components/schedule-dialog.tsx` — **nuevo**
- `web/src/modules/schedules/queries.ts` — `useAvailability` soporta batch, nuevo `useDoctorSchedules`
- `web/src/modules/staff-admin/queries.ts` — `useDoctores` soporta `withAvailability`

**Deploy:**
- Migración BD requerida (campo `version` en `schedules`)
- Deploy coordinado frontend+backend (GitHub Actions ya configurado)