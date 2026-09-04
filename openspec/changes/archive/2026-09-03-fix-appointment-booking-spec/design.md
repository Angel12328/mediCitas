## Context

Ver `proposal.md` - Why. El backend ya implementa correctamente la validación con `slotCapacity` + `bookedCount` + bloqueo optimista en `Schedule.version`. El frontend ya consume `available = slotCapacity - bookedCount` del endpoint `/schedules/availability`. Este change solo corrige la especificación formal para que refleje la realidad implementada.

**Estado actual (backend):**
- `appointment.service.ts:48-58` — `bookedCount` cuenta citas con `status IN ('PENDING','CONFIRMED','COMPLETED')` por `scheduleId + date`; valida `bookedCount < slotCapacity`
- `schedule.routes.ts:71-92` — `/availability` agrupa por `scheduleId`, cuenta citas activas, calcula `available = slotCapacity - bookedCount`, filtra `available > 0`
- `schedule.service.ts:4-12` — `daysBitmask` bit 0=Lun … bit 6=Dom; `maskIncludesDay()` verifica si fecha cae en día de atención

**Estado actual (frontend):**
- `queries.ts` — `AvailabilitySlot` incluye `slotCapacity`, `booked`, `available`
- `use-availability-by-date-range.ts` — fetch por día, mapa `availabilityByDate`
- `month-calendar.tsx:137` — indicador visual usa `totalAvailable` (suma de `available` por franja)
- `doctor-card.tsx:68` — muestra `nextSlot.available` cupos libres

## Goals / Non-Goals

**Goals:**
- Documentar arquitectura actual de validación de cupos como referencia canónica
- Confirmar que `slotCapacity` (pacientes/franja/día) y `daysBitmask` (días/semana) tienen roles separados y correctos
- Servir como base para futuros cambios en calendario/disponibilidad sin reintroducir confusión

**Non-Goals:**
- Cambios de código (backend/frontend ya correctos)
- Nueva migración de BD
- Cambios en API contracts

## Decisions

### Decision 1: `slotCapacity` = capacidad por franja/día (fuente de verdad para reserva)

**Elección:** `slotCapacity` (campo `slot_capacity` en `schedules`) es el límite duro de pacientes por franja horaria por día. Validación: `bookedCount < slotCapacity`.

**Rationale:** Coincide con modelo relacional original ("número de cupos" en `HorarioAtencion`) y con implementación actual en `bookAppointment()` y `/availability`.

**Alternativas:**
- Usar `cupos` (días/semana) como capacidad → incorrecto, permite sobre-reserva
- Campo separado `capacidadPorFranja` → duplicado innecesario

### Decision 2: `daysBitmask` = días de atención por semana (fuente para calendario)

**Elección:** `daysBitmask` (bits 0-6 = Lun-Dom) determina qué días atiende el médico en esa franja. `cuposSemana = popcount(daysBitmask)` se deriva en runtime para UI de calendario.

**Rationale:** Evita columna redundante en BD. `daysBitmask` ya existe y es fuente de verdad para "¿atiende este día?". Calendario usa bits para habilitar/deshabilitar celdas.

**Alternativas:**
- Columna `diasPorSemana` en BD → duplicación, riesgo de inconsistencia con `daysBitmask`
- Enum/array de días → menos eficiente para queries de solapamiento

### Decision 3: Separación estricta de responsabilidades

| Componente | Usa | Para |
|------------|-----|------|
| Reserva/Validación | `slotCapacity` + `bookedCount` | Límite duro de pacientes por franja/día |
| Calendario (día habilitado) | `daysBitmask` | ¿Médico atiende este día de la semana? |
| Calendario (indicador cupos) | `slotCapacity - bookedCount` por franja | ¿Hay cupos libres en al menos una franja? |
| Doctor card (próximo slot) | `available` de `/availability` | Cupos libres en próxima franja del día |

**Rationale:** Cada concepto tiene una responsabilidad única. Mezclarlos (como en spec anterior) causa bugs de validación.

### Decision 4: Endpoint `/schedules/availability` como fuente única de verdad

**Elección:** Frontend **solo** confía en `available` devuelto por `/availability`. No recalcula `slotCapacity - bookedCount` en cliente.

**Rationale:** Evita race conditions entre lectura de disponibilidad y reserva. Backend tiene vista consistente con bloqueo optimista.

**Alternativas:**
- Frontend recalcula → riesgo de stale data, doble lógica

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|------------|
| Spec y código se desincronicen en futuro | Tests de integración (`appointment-module.test.ts`) validan comportamiento real; CI falla si spec miente |
| Nuevo desarrollador confunda `slotCapacity` vs `cuposSemana` | Nombres claros en código (`slotCapacity`), comentarios en schema.prisma, este design.md como referencia |
| Calendario muestre "Disponible" pero al click no haya slots | `/availability` ya filtra `available > 0`; calendario usa mismo dato (`totalAvailable = sum(available)`) |
| Múltiples franjas mismo día con distinta `slotCapacity` | Cada franja es Schedule independiente con su `slotCapacity`; `/availability` devuelve array por franja |

## Migration Plan

No aplica — sin cambios de código ni BD. Este change es **solo documentación/especificación**.

## Open Questions

- Ninguna — comportamiento actual validado por tests y en producción