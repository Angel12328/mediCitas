## 1. Validación de especificación corregida

- [x] 1.1 Verificar que delta spec en `specs/appointments/booking/spec.md` corrige definición de "cupos" usando `slotCapacity` (no días/semana) — **verificación**: leer spec y confirmar que escenarios usan `bookedCount < slotCapacity` y `daysBitmask` para calendario
- [x] 1.2 Confirmar que design.md documenta arquitectura actual sin proponer cambios de código — **verificación**: design.md se refiere a `appointment.service.ts`, `schedule.routes.ts` existentes como implementación correcta

## 2. Verificación de consistencia código-spec

- [x] 2.1 Ejecutar tests de citas y confirmar que pasan con comportamiento actual — **verificación**: `npm test -- tests/modules/appointments/appointment-module.test.ts` pasa
- [x] 2.2 Verificar que endpoint `/schedules/availability` devuelve `available = slotCapacity - bookedCount` — **verificación**: test de integración o request manual a API devuelve estructura esperada
- [x] 2.3 Confirmar que calendario frontend usa `daysBitmask` para habilitar días y `available` para indicador — **verificación**: revisar `month-calendar.tsx` y `doctor-card.tsx` coinciden con design.md

## 3. Archivado del change

- [x] 3.1 Validar change completo con `openspec validate` — **verificación**: comando pasa sin errores
- [x] 3.2 Archivar change con `openspec archive` — **verificación**: change movido a `openspec/changes/archive/` con specs aplicados a `openspec/specs/appointments/booking/spec.md`