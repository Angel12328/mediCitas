## Context

**Estado actual:**
- Wizard `AgendarWizard` en `web/src/modules/appointments/components/agendar-wizard.tsx` (388 líneas) implementa flujo 4 pasos: Especialidad → Doctor Cards → MonthCalendar + Panel Horarios → ConfirmDialog
- `DoctorCard` muestra "Próximo: HH-HH · N cupos" derivado de `useAvailabilityByDateRange` para fecha actual
- `MonthCalendar` consume `useAvailabilityByDateRange` (fetch paralelo por día del mes)
- `useAvailabilityByDateRange` hace N requests a `/api/proxy/schedules/availability` (uno por día) — problema N+1
- Backend `/availability` valida cupo y rechaza 409 si lleno, pero **sin control de concurrencia** (race condition)
- Faltan validaciones: overlap, ventana antelación, límites paciente, optimistic lock
- `doctors/schedules` spec define `/availability` por fecha única; no soporta batch por mes
- Lista doctores via `useDoctores(specialtyId)` — sin info de disponibilidad, sin filtros server-side

**Constraints:**
- Stack: Next.js 15 (App Router) + Fastify + Prisma 7 + PostgreSQL 17
- Deploy: Vercel (frontend) + Render (backend) via GitHub Actions
- Migración BD requerida para `Schedule.version`
- Componentes UI base: shadcn/ui (Radix), TanStack Query, React Hook Form, Zod v4

## Goals / Non-Goals

**Goals:**
- Rediseñar wizard a 3 pasos con ScheduleDialog (Vista 1: WeeklyScheduleList, Vista 2: DatePickerWithAvailability)
- Implementar validaciones robustas: optimistic lock, overlap, antelación, límites, duplicados
- Endpoint `/doctors?withAvailability` para filtros/ordenamiento server-side
- Batch availability por mes para DatePickerWithAvailability (fetch on-demand)
- Eliminar `MonthCalendar`, `useAvailabilityByDateRange`, panel horarios lateral
- DoctorCard V2 con resumen semanal + `[Ver agenda]`

**Non-Goals:**
- Lista de espera (waitlist) — fuera de scope (decisión A en propuesta)
- Validación obra social/plan — fuera de scope (decisión A)
- Notificaciones push/email — separado (change `medicitas-notifications` en progreso)
- Refactor completo de `agendar-wizard.tsx` a server components — mantener client component por interactividad
- Tests E2E Playwright — tareas separadas, no en este change

## Decisions

### 1. ScheduleDialog como Dialog único con dos vistas (vs dos Dialogs separados)

**Decisión:** Un `Dialog` con estado interno `view: 'weekly' | 'datePicker'` que renderiza condicionalmente `WeeklyScheduleList` o `DatePickerWithAvailability`.

**Rationale:**
- Transición fluida sin parpadeo (mismo `DialogContent`)
- Header/footer sticky compartidos (Volver, Cancelar, Confirmar)
- Estado `selectedScheduleId` + `selectedDate` vivo en wizard padre
- Evita focus trap issues de anidar Dialogs

**Alternativa considerada:** Dos Dialogs (`ScheduleDialog` + `DatePickerDialog`) — descartado por UX (parpadeo, doble close, focus management complejo).

### 2. WeeklyScheduleList: lista agrupada por daysBitmask (Opción B)

**Decisión:** Agrupar horarios por `daysBitmask` idéntico → headers "Lunes – Viernes", "Sábado", etc. Cada horario = fila con ícono, rango, cupos, botón.

**Rationale:**
- Compacto vertical (bueno para móvil)
- Semántica clara: días con mismos horarios = una sección
- Fácil de renderizar: `groupBy(schedules, s => s.daysBitmask)`
- Ícono por franja: ☀ (06-12), 🌤 (12-18), 🌙 (18-23) — hardcodeado, configurable después

**Alternativa considerada:** Grid 7 columnas (Opción A) — descartado por ancho móvil y complejidad responsiva.

### 3. DatePickerWithAvailability: grid mes + lista vertical (Patrón 2)

**Decisión:** Grid mes navegable (react-day-picker) + lista vertical "Lun 8 sep · 08-12 · 8/10 [Elegir]". Fetch batch por mes al navegar grid.

**Rationale:**
- Grid da contexto visual de semanas/meses
- Lista muestra cupos reales por día (requisito clave)
- Fetch batch `/availability?scheduleId&startDate&endDate` = 1 request/mes vs 30 requests/día
- Radio button en lista = selección única clara

**Alternativa considerada:** Bottom Sheet nativo — descartado por dependencia extra; híbrido responsive (Dialog full-width móvil) suficiente.

### 4. Optimistic Lock en Schedule.version

**Decisión:** Añadir `version Int @default(1)` a modelo `Schedule`. En `bookAppointment`: leer `version`, validar cupo, `UPDATE ... SET version = version + 1 WHERE id = ? AND version = ?`. Si 0 rows → `CONCURRENT_BOOKING` → retry frontend (3× backoff 100/200/300ms).

**Rationale:**
- Nativo PostgreSQL, sin Redis extra
- Funciona con 1 o N instancias API (Render escala horizontal)
- Latencia mínima (solo conflict real paga retry)
- Prisma soporta `where: { id, version }` en update

**Alternativa considerada:** Pessimistic `FOR UPDATE` — descartado por deadlocks potenciales y no escalar horizontal sin Redis. Redis Lock — descartado por dependencia operativa extra.

### 5. Batch Availability Endpoint

**Decisión:** Extender `GET /availability` con query params opcionales `scheduleId`, `startDate`, `endDate`. Si `scheduleId` + rango presentes → devuelve array `[{ date, scheduleId, startTime, endTime, slotCapacity, booked, available }]`. Mantener compatibilidad: sin `scheduleId` + rango → comportamiento actual (fecha única requerida).

**Rationale:**
- Un endpoint, dos modos (fecha única vs batch por schedule)
- Frontend usa batch solo en DatePickerWithAvailability
- Response incluye `daysBitmask` del schedule para que frontend sepa días de atención

**Alternativa considerada:** Nuevo endpoint `/availability/batch` — descartado por fragmentar API; query params opcionales más RESTful.

### 6. Doctors withAvailability Endpoint

**Decisión:** Extender `GET /doctors` con `withAvailability=true&daysAhead=30`. Añade `availabilitySummary` a cada doctor. Soporta `sort=availability` y `filter=hasAvailabilityThisWeek`. Cálculo via CTE SQL raw (performance) o Prisma `$queryRaw`.

**Rationale:**
- Elimina N+1 requests frontend (1 request vs 20+)
- Filtros/ordenamiento server-side = paginación correcta
- `daysAhead=30` configurable, default 30
- CTE con `generate_series` + `daysBitmask` match + LEFT JOIN appointments = query única eficiente

**Alternativa considerada:** Endpoint separado `/doctors/availability` — descartado; query param opcional mantiene API unificada.

### 7. DoctorCard V2 Props

**Decisión:** Nuevo prop `schedules: ScheduleItem[]` (viene de `useDoctores` con `withAvailability`). Card computa resumen: `groupBy(schedules, s => s.daysBitmask)` → "Lun-Vie 08-12, 14-17 | Sáb 09-13". Badge: `${schedules.length} horarios · ${nextSlot?.available ?? 0} cupos próximo`. Botón `[Ver agenda]`.

**Rationale:**
- Reutiliza datos ya fetchados (no request extra)
- Resumen honesto: muestra patrón semanal, no promete slot específico
- `[Ver agenda]` action clara vs selección implícita

### 8. Validaciones en appointment.service.ts

**Decisión:** Centralizar en `createAppointment`:
1. `maskIncludesDay(schedule.daysBitmask, date)` — fecha válida
2. `booked < slotCapacity` — cupo
3. `version` check — optimistic lock
4. Overlap query — cita existente mismo paciente + solape horario
5. Antelación 2h/60d — config constants
6. Límites daily/weekly — counts por paciente
7. Unique constraint BD — duplicado exacto

**Rationale:**
- Single source of truth en service
- Errores tipados (`AppError` codes) para frontend
- Transacción única atómica

### 9. Migración BD: Schedule.version

**Decisión:** Migración Prisma:
```prisma
model Schedule {
  // ...
  version Int @default(1)
}
```
Backfill: `UPDATE schedules SET version = 1 WHERE version IS NULL;` (Prisma `@default(1)` lo hace auto).

**Rollback:** `ALTER TABLE schedules DROP COLUMN version;` — seguro, no rompe reads (campo nuevo).

### 10. Frontend Hooks Architecture

**Nuevos hooks:**
- `useDoctorSchedules(doctorId, specialtyId)` → `GET /schedules?doctorId&specialtyId` (para WeeklyScheduleList)
- `useScheduleAvailability(scheduleId, startDate, endDate)` → batch availability (para DatePickerWithAvailability)

**Modificados:**
- `useDoctores(specialtyId, { withAvailability, daysAhead })` — pasa query params
- `useAvailability(doctorId, specialtyId, date)` — mantiene compatibilidad (fecha única)
- `useBookAppointment` — añade retry logic para `CONCURRENT_BOOKING`

**Eliminados:**
- `useAvailabilityByDateRange` — reemplazado por `useScheduleAvailability` + `useDoctorSchedules`

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|------------|
| **Batch availability response grande** (30 días × horarios) | Paginación implícita por mes; frontend solo pide mes visible; `daysAhead` default 30 configurable |
| **CTE SQL raw en doctors/availability** — acoplamiento a PostgreSQL | Documentar query; tests de integración cubren; si cambia BD, solo este endpoint |
| **Optimistic lock retry infinito en alta contención** | Max 3 retries + backoff exponencial; si falla 3× → error "Horario completo" (legítimo) |
| **ScheduleDialog ancho completo móvil rompe otros Dialogs** | CSS scoped al componente; `max-w-full sm:max-w-lg` solo este diálogo |
| **Filtro `hasAvailabilityThisWeek` stale** (cache React Query) | `staleTime: 30s` en `useDoctores`; `refetchOnWindowFocus: true`; invalidar tras reserva |
| **Eliminar MonthCalendar rompe otros usos** | Verificar imports: solo `agendar-wizard.tsx` lo usa. Si otros, crear `MonthCalendarLegacy` o migrar |
| **DoctorCard resumen semanal hardcodea íconos franja** | Constante `TIME_SLOT_ICONS` exportable; configurable después sin romper spec |

## Migration Plan

### Paso 1: Backend — Migración BD + Optimistic Lock
1. `prisma migrate dev --name add_schedule_version` (añade `version Int @default(1)`)
2. Actualizar `appointment.service.ts` con validaciones + optimistic lock
3. Tests unitarios: concurrencia, overlap, límites, antelación
4. Deploy backend (Render) — health check `/health` + `/availability` smoke test

### Paso 2: Backend — Endpoints Enriquecidos
1. Extender `/availability` con `scheduleId`, `startDate`, `endDate` (batch)
2. Extender `/doctors` con `withAvailability`, `daysAhead`, `sort`, `filter`
3. CTE SQL raw para `availabilitySummary` (performance)
4. Tests integración: batch response, summary correctness, sort/filter

### Paso 3: Frontend — Hooks + Componentes Core
1. Crear `useDoctorSchedules`, `useScheduleAvailability`
2. Crear `ScheduleDialog`, `WeeklyScheduleList`, `DatePickerWithAvailability`
3. Actualizar `DoctorCard` (props `schedules`, resumen, `[Ver agenda]`)
4. Eliminar `MonthCalendar`, `useAvailabilityByDateRange`
5. Storybook/visual tests componentes nuevos

### Paso 4: Frontend — Wizard Integration
1. Reescribir `AgendarWizard` flujo 3 pasos
2. Integrar `ScheduleDialog` controlado (abre/cierra via state)
3. Checkbox "Con disponibilidad esta semana" → filtra `useDoctores` data
4. Retry logic en `useBookAppointment` para `CONCURRENT_BOOKING`

### Paso 5: Deploy Coordinado
1. PR único con migración + backend + frontend
2. GitHub Actions: `deploy-backend` → espera success → `deploy-frontend`
3. Smoke test producción: `/citas/agendar` flujo completo
4. Rollback: `git revert` + push → auto-deploy previo

## Open Questions

1. **Íconos franja horaria**: ¿Hardcodear ☀/🌤/🌙 por rangos fijos (06-12, 12-18, 18-23) o hacer configurable via constante exportable? → *Resoluble en implementación, no cambia spec*

2. **react-day-picker vs grid custom**: ¿Usar `react-day-picker` (dependencia nueva, ~15kb) o grid custom simple? → *Evaluar bundle size; grid custom 50 líneas, sin dep*

3. **Excepción admin UI**: ¿Dónde vive "Solicitar excepción" en card/calendar? ¿Modal propio o toast + email a recepción? → *Definir en tasks, no bloquea specs*

4. **Cache invalidation `useDoctores`**: ¿`staleTime: 30s` suficiente o invalidar explícitamente tras `bookAppointment`? → *Probar en staging; decisión en tasks*

5. **Batch availability pagination**: ¿Si doctor tiene 10 horarios × 30 días = 300 items response? → *Filtrar por `scheduleId` en query (frontend ya sabe cuál seleccionó); response ≤ 30 items*