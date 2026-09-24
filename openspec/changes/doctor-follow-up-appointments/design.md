## Context

**Estado actual:**
- Agenda del doctor (`/agenda`) usa `useAppointments` → lista plana de citas del día
- Acciones: botones inline "Atendido" / "No asistió" → `PATCH /appointments/:id/status`
- Transiciones: `PENDING` → `COMPLETED` (salta `CONFIRMED`), `NO_SHOW` desde `CONFIRMED`
- Endpoint `GET /schedules/availability?doctorId&specialtyId&date` ya existe y filtra por especialidad
- `bookAppointment()` en service maneja: bitmask, cupo, solapamiento, ventana 2h–60d, bloqueo optimista
- `AppointmentDto` tiene `specialtyName` pero no `specialtyId`

**Restricciones:**
- ESM con imports `.js` obligatorios
- Prisma 7 con `@prisma/adapter-pg`
- Tests seriales (`fileParallelism: false`) con BD real
- No mocking de Prisma en tests API
- shadcn/ui + TanStack Query + Zod v4 en frontend

## Goals / Non-Goals

**Goals:**
- Vista agenda agrupada por `Schedule` (horarios) con cupos visibles
- Flujo `PENDING` → `CONFIRMED` → `COMPLETED` iniciado por doctor
- Modal "Nueva cita de control" solo desde `COMPLETED`, filtrado por `specialtyId`
- Cita original `COMPLETED` inalterada; nueva cita `PENDING` independiente
- Reutilizar validaciones y bloqueo optimista de `bookAppointment()`

**Non-Goals:**
- Cancelar/reprogramar cita original al crear seguimiento
- Trazabilidad automática `originalAppointmentId` en BD (solo en request para copiar nota)
- Notificaciones automáticas al paciente (fuera de alcance)
- Agenda semanal/mensual (solo día seleccionado)
- Edición de observaciones en modal follow-up

## Decisions

### 1. Nuevo endpoint `/doctors/me/agenda?date=` vs extender `/appointments`

**Decisión:** Nuevo endpoint dedicado `GET /api/v1/doctors/me/agenda?date=`

**Rationale:**
- Semántica clara: "agenda del doctor para un día" ≠ "lista de citas"
- Respuesta ya agrupada por `Schedule` evita procesamiento en frontend
- Permite metadatos por horario: `specialtyName`, `slotCapacity`, `bookedCount`
- Extensible: `waitingCount`, `avgWaitTime`, `revenueEstimate` por horario
- Permisos naturales: solo DOCTOR (dueño) o ADMIN

**Alternativa considerada:** `GET /appointments?groupBy=schedule&date=` — rechazada: rompe paginación offset/limit, mezcla responsabilidades, parámetro "mágico".

### 2. Endpoint follow-up: `POST /appointments/follow-up` vs `POST /appointments/:id/reschedule`

**Decisión:** `POST /appointments/follow-up` con body `{ patientId, scheduleId, date, originalAppointmentId? }`

**Rationale:**
- No es "reschedule" (no cancela original) → nombre semántico distinto
- `originalAppointmentId` opcional en body (no en URL) porque solo sirve para copiar observación
- Reutiliza `bookAppointment()` internamente
- `201 Created` con datos de nueva cita

**Alternativa considerada:** `POST /appointments/:id/follow-up` — rechazada: implica relación jerárquica fuerte que no modelamos en BD.

### 3. Filtrado por especialidad en modal: `specialtyId` obligatorio

**Decisión:** Modal requiere `specialtyId` de la cita original; `useHorariosDisponibles` lo pasa a `/schedules/availability`

**Rationale:**
- Regla clínica: seguimiento = misma patología = misma especialidad
- Backend ya soporta `specialtyId` en availability (sin cambios)
- Evita errores: cardiólogo no agenda control en dermatología

**Alternativa considerada:** Permitir elegir especialidad en modal — rechazada: complejidad UX innecesaria, rompe regla clínica.

### 4. `specialtyId` en `AppointmentDto`

**Decisión:** Añadir `specialtyId: string` al DTO (backend `toDto` + frontend types)

**Rationale:**
- Necesario para pasar al modal sin query extra
- Ya disponible en `appointment.schedule.specialty.id` (include existente)

### 5. Dropdown híbrido (Botón principal + menú ▼)

**Decisión:** `DropdownMenuTrigger asChild` con `Button` principal + `DropdownMenuContent` para secundarias

**Rationale:**
- "Atendido/Confirmar" = 1 clic (acción #1 del doctor, 80% casos)
- "No asistió / Agendar control" = 2 clics (deliberado, evita errores)
- Tabla no se ensancha; móvil OK
- Extensible: añadir "Ver expediente", "Recetar" sin rediseño

**Alternativa considerada:** 4 botones inline — rechazada: tabla ancha, móvil scroll horizontal.

### 6. Transición `PENDING → CONFIRMED` por doctor

**Decisión:** Doctor (dueño del horario) puede confirmar llegada; matriz `TRANSITIONS` ya lo permite (`STAFF`)

**Rationale:**
- Flujo real: paciente llega → doctor confirma → consulta → doctor atiende
- `CONFIRMED` diferenciar "llegó" vs "pendiente de llegar"
- Admin también puede (casos edge)

### 7. Validaciones follow-up reutilizan `bookAppointment()`

**Decisión:** `createFollowUp()` llama a `bookAppointment()` internamente tras validar `originalAppointmentId`

**Rationale:**
- DRY: bitmask, cupo, solapamiento, ventana, bloqueo optimista ya probados
- Comportamiento idéntico a reserva de paciente
- Tests existentes cubren edge cases

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|------------|
| **Doble booking visual**: Doctor ve cita original COMPLETED + nueva PENDING en días distintos | UI distingue claramente: badge COMPLETED (historial) vs PENDING (próxima) |
| **Modal sin horarios disponibles** (fecha sin cupos en especialidad) | Mostrar Alert amarilla + botón "Otra fecha"; no permitir confirmar sin horario |
| **Concurrencia en follow-up**: dos doctores agendan mismo cupo | `bookAppointment()` ya maneja con bloqueo optimista + reintentos (3x) |
| **Especialidad hardcodeada**: doctor con múltiples especialidades solo ve una en follow-up | Por diseño: seguimiento = misma especialidad. Si necesita otra, crea cita normal desde `/citas/agendar` |
| **`specialtyId` faltante en DTO existente** | Migración simple: añadir en `toDto` + regenerar types frontend (`npm run api:schema`) |
| **Tests seriales lentos** (agenda + follow-up + transitions) | Agrupar en `describe` compartido; reutilizar fixtures `doctorRecordId`, `patientId` |

## Migration Plan

1. **Backend - Paso 1**: Añadir `specialtyId` a `AppointmentDto` (`toDto` en `appointment.routes.ts`)
2. **Backend - Paso 2**: Crear `GET /doctors/me/agenda?date=` en `doctor.routes.ts`
3. **Backend - Paso 3**: Crear `POST /appointments/follow-up` en `appointment.routes.ts` + `createFollowUp` en service
4. **Backend - Paso 4**: Tests unitarios para `createFollowUp` + E2E agenda→follow-up
5. **Frontend - Paso 1**: Regenerar types (`npm run api:schema`)
6. **Frontend - Paso 2**: Hooks `useAgendaDoctor`, `useHorariosDisponibles`, `useCrearFollowUp` en `queries.ts`
7. **Frontend - Paso 3**: Componente `FollowUpModal.tsx`
8. **Frontend - Paso 4**: Refactor `AgendaDoctor.tsx` → vista por horarios + dropdown híbrido
9. **Frontend - Paso 5**: Tests componente + E2E Playwright
10. **Deploy**: `npm run build` → `docker build` (Dockerfile copia `dist/`)

**Rollback:** Revertir commits individuales; BD sin migraciones (solo código).

## Open Questions

1. **¿Copiar observación siempre o solo si checkbox?** → Por ahora: siempre si existe (simple). Checkbox = futuro.
2. **¿Notificación al paciente al crear follow-up?** → Fuera de alcance (issue separado).
3. **¿Límite de seguimientos por paciente?** → No por ahora; validación de cupo/solapamiento basta.
4. **¿Agenda muestra citas `NO_SHOW` del día?** → Sí, aparecen en su horario con badge; no accionables.