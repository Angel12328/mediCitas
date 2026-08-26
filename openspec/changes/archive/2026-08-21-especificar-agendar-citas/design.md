## Context

El modelo relacional ya existe (`modelo_relacional.mwb`) con tablas `Cita`, `HorarioAtencion`, `Paciente`, `Doctor`, `Especialidad`. La propuesta y specs definen el comportamiento. No hay código de aplicación aún—este diseño guía la primera implementación.

Ver `proposal.md` para motivación y `specs/appointments/booking/spec.md` para requisitos detallados.

## Goals / Non-Goals

**Goals:**
- Definir la arquitectura de la capa de datos y lógica de negocio para reserva de citas
- Establecer patrones reutilizables para validación de disponibilidad y concurrencia
- Documentar decisiones que afecten futuras capacidades (reprogramar, lista de espera, notificaciones)

**Non-Goals:**
- Implementar API HTTP, UI, autenticación, notificaciones
- Decisiones de infraestructura (DB hosting, ORM, framework web)
- Manejo de zonas horarias (se asume fecha local del consultorio)

## Decisions

### Decision 1: Capa de acceso a datos — Repository pattern sobre el modelo relacional

**Elección:** Un `AppointmentRepository` encapsula todas las consultas SQL sobre `Cita` y `HorarioAtencion`.

**Rationale:** Separa lógica de negocio de SQL, facilita testing con mocks, y permite cambiar implementación (p.ej. stored procedures) sin tocar casos de uso.

**Alternativas consideradas:**
- ORM completo (TypeORM, Prisma) — muy pesado para el alcance actual
- SQL directo en casos de uso — acopla lógica a esquema

### Decision 2: Validación de disponibilidad — Transacción con SELECT FOR UPDATE

**Elección:** Dentro de una transacción de BD:
1. `SELECT ... FROM HorarioAtencion WHERE id = ? FOR UPDATE`
2. Contar `Cita` existentes para ese `idHorarioAtencion` y `fecha`
3. Si `count < numeroCupos`, `INSERT Cita` con `posicion = count + 1`

**Rationale:** `FOR UPDATE` bloquea la fila del horario, evitando race conditions sin locks de aplicación. Garantiza atomicidad a nivel BD.

**Alternativas consideradas:**
- Lock optimista con `version` column — requiere columna extra, más complejidad
- Lock de aplicación (Redis mutex) — añade dependencia externa innecesaria

### Decision 3: Búsqueda de horarios — Vista materializada o query compuesta

**Elección:** Query SQL con JOINs sobre `HorarioAtencion` → `Doctor` → `DoctorEspecialidad` → `Especialidad`, filtrando por `diasAtencion` (bitmask o enum) coincidente con día de semana de la fecha, y `LEFT JOIN` a `Cita` para contar cupos ocupados.

**Rationale:** Una sola query devuelve todo lo necesario para la UI (horario + cupos libres). Evita N+1.

**Alternativas consideradas:**
- Vista materializada refrescada por trigger — complejidad operativa prematura
- Múltiples queries — más simple pero N+1 en conteo de cupos

### Decision 4: Modelo de dominio — Value Objects para reglas puras

**Elección:** `AvailabilityChecker` (función pura) recibe `HorarioAtencion`, `fecha`, `cuposOcupados` y devuelve `AvailableSlot | null`. Sin efectos secundarios.

**Rationale:** Lógica de negocio testeable en aislamiento, independiente de BD. Fácil de extender (p.ej. reglas de "mínimo 2h de antelación").

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|------------|
| `FOR UPDATE` bloquea todo el horario bajo alta concurrencia | Cupos típicos son pequeños (10-30); bloqueo dura ms. Monitorear y optimizar si es cuello de botella |
| `diasAtencion` como INT (bitmask) dificulta queries legibles | Documentar mapping bit→día; helper function en repo |
| Columnas ocultas en `Cita` pueden cambiar el modelo | Confirmar esquema real antes de implementar; diseñar repo extensible |
| No hay definición de estados de `Cita` (pendiente, confirmada, cancelada, no-asistió) | Asumir `estado` ENUM en `Cita`; documentar como decisión pendiente |

## Open Questions

- ¿Se necesita soporte para "lista de espera" cuando horario está lleno? (Post-MVP)
- ¿Notificaciones (email/SMS) al confirmar/cancelar? (Fuera de scope)
- ¿Zona horaria del consultorio vs. paciente? (Asumir local por ahora)