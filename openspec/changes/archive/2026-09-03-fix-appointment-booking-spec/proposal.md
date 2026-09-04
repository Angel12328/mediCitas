## Why

El spec archivado `2026-09-04-enhance-appointment-booking` confunde dos conceptos distintos: **`slotCapacity`** (capacidad de pacientes por franja horaria por día) y **`cupos`** (días de atención por semana, derivado del `daysBitmask`). Esto lleva a validaciones incorrectas donde se usa "días/semana" como límite de reserva en lugar de "pacientes por franja/día". El backend ya implementa correctamente la validación con `slotCapacity` y `bookedCount`; la spec debe reflejar esa realidad.

## What Changes

- **Corregir definición de "cupos"**: Separar claramente `slotCapacity` (capacidad por franja/día) de `cupos` derivado (días laborables/semana = `popcount(daysBitmask)`).
- **Actualizar escenarios de disponibilidad**: Validación de reserva usa `bookedCount < slotCapacity` para `scheduleId + date`; calendario usa `daysBitmask` para saber qué días atiende y `slotCapacity - bookedCount` para cupos libres por franja.
- **Eliminar confusión en spec anterior**: Remover referencias a `pacientes_agendados < cupos` donde `cupos` significaba días/semana.

## Capabilities

### Modified Capabilities

- `appointments/booking`: Flujo completo de reserva de citas médicas — validación de disponibilidad por franja horaria, creación de cita con posición atómica, calendario interactivo con indicadores correctos.

## Impact

- **Specs**: `specs/appointments/booking/spec.md` (delta spec con requisitos corregidos)
- **Backend**: Sin cambios — ya implementa correctamente `slotCapacity` + `bookedCount` con bloqueo optimista (`appointment.service.ts`, `schedule.routes.ts`)
- **Frontend**: `useAvailability` hook y componentes de calendario/doctor-card ya consumen `available = slotCapacity - bookedCount`; solo documentación/spec se alinea
- **Tests**: `appointment-module.test.ts` valida comportamiento actual correcto