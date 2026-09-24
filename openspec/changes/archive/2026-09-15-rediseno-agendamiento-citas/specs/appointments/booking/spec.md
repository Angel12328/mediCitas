## MODIFIED Requirements

### Requirement: Paciente busca horarios disponibles

El sistema SHALL permitir buscar horarios de atención filtrando por especialidad y doctor, con una interfaz que incluya cards visuales de doctores con resumen semanal, diálogo de agenda semanal, y selector de fecha con grid mes + lista de cupos.

#### Scenario: Búsqueda por especialidad y fecha con cards de doctores
- **WHEN** paciente selecciona una especialidad en el dropdown de filtros
- **THEN** sistema muestra un grid de cards de doctores con esa especialidad activa
- **AND** cada card muestra: nombre del doctor, especialidad, resumen semanal "Lun-Vie 08-12, 14-17 | Sáb 09-13", conteo "3 horarios · 8 cupos próximo", y botón `[Ver agenda]`
- **AND** paciente abre la agenda del doctor haciendo click en `[Ver agenda]`

#### Scenario: Búsqueda por doctor específico con búsqueda por nombre
- **WHEN** paciente escribe en el input de búsqueda por nombre de doctor
- **THEN** sistema filtra las cards en tiempo real coincidiendo con nombre completo
- **AND** dropdown de especialidad se resetea a "Todas"
- **WHEN** paciente selecciona un doctor de las cards filtradas
- **THEN** sistema abre ScheduleDialog con agenda semanal del doctor

#### Scenario: Agenda semanal en diálogo muestra horarios agrupados por días
- **WHEN** paciente clica `[Ver agenda]` en una card de doctor
- **THEN** se abre diálogo con lista de horarios agrupados por `daysBitmask` (ej: "Lunes – Viernes", "Sábado")
- **AND** cada horario muestra: ícono franja (☀/🌤/🌙), rango "08:00–12:00", cupos "8/10", botón `[Seleccionar]`
- **AND** horarios con `available=0` muestran `[Completo]` disabled

#### Scenario: Selector de fecha en diálogo muestra grid mes + lista cupos
- **WHEN** paciente clica `[Seleccionar]` en un horario de la agenda semanal
- **THEN** diálogo cambia a vista selector de fecha para ese `scheduleId`
- **AND** muestra grid mes navegable: días con horario en `daysBitmask` = bold, días pasados = disabled
- **AND** lista vertical "Fechas disponibles": cada fila = radio + "Lun 8 sep · 08:00–12:00 · 8 cupos de 10" + `[Elegir]`
- **AND** fetch on-demand al navegar mes en grid
- **AND** paciente selecciona fecha clicando fila o `[Elegir]`

#### Scenario: Calendario interactivo muestra disponibilidad por día
- **WHEN** paciente navega el grid mes en DatePickerWithAvailability
- **THEN** para cada día:
  - **SI** día no está en `daysBitmask` de la franja seleccionada → deshabilitado (médico no atiende ese día en esa franja)
  - **SI** día está en `daysBitmask` PERO `available = 0` → "Sin cupos" (atende pero lleno)
  - **SI** día está en `daysBitmask` Y `available > 0` → "Disponible" (bold en grid, cupos en lista)
- **WHEN** paciente hace click en una fecha con disponibilidad
- **THEN** fecha se marca como seleccionada, radio button activado, botón "Revisar y Confirmar" habilitado

#### Scenario: Fecha pasada no seleccionable en calendario
- **WHEN** paciente navega a mes anterior o hace click en día anterior a hoy en grid
- **THEN** días pasados lucen deshabilitados y no son seleccionables (independiente de `daysBitmask`)

### Requirement: Sistema valida disponibilidad de cupos

El sistema SHALL validar que existan cupos libres en la franja horaria específica para la fecha consultada, usando bloqueo optimista para concurrencia y excluyendo cupos completos de la agenda semanal.

**Definiciones:**
- **Franja horaria (Schedule/HorarioAtencion)**: combinación única de `doctorId`, `specialtyId`, `daysBitmask`, `startTime`, `endTime`, `slotCapacity`
- **Capacidad por franja/día (slotCapacity)**: número máximo de pacientes que pueden agendarse en **esa franja** para **un día específico** (campo `slot_capacity` en BD)
- **Días de atención (daysBitmask)**: bitmask que indica qué días de la semana atiende el médico en esa franja (bit 0=Lun … bit 6=Dom)
- **Cupos por semana (derivado)**: `popcount(daysBitmask)` = total de días laborables por semana en esa franja; usado **solo** para indicador visual en calendario interactivo

#### Scenario: Cupo disponible en selección de horario
- **WHEN** paciente selecciona un horario donde `bookedCount < slotCapacity` para esa fecha y franja (`scheduleId` + `startTime`)
- **THEN** sistema permite avanzar al paso de confirmación
- **AND** horario muestra `available = slotCapacity - bookedCount` cupos libres en la card/selector

#### Scenario: Sin cupos disponibles - horario no seleccionable
- **WHEN** un horario tiene `bookedCount >= slotCapacity` para esa fecha y franja
- **THEN** horario se muestra como "Completo" y no es seleccionable en el paso 1
- **AND** doctor card muestra "Sin disponibilidad" si **todas** sus franjas tienen `available = 0` para esa fecha

#### Scenario: Backend cuenta pacientes agendados por horario/día/hora
- **WHEN** backend recibe consulta de disponibilidad (`/schedules/availability`)
- **THEN** para cada `HorarioAtencion`, cuenta citas donde `scheduleId = ?` AND `date = ?` AND `deletedAt IS NULL` AND `status NOT IN ('CANCELLED', 'NO_SHOW')`
- **THEN** `available = (slotCapacity - bookedCount) > 0`
- **THEN** devuelve por franja: `scheduleId`, `startTime`, `endTime`, `slotCapacity`, `bookedCount`, `available`

#### Scenario: Backend rechaza reserva si no hay cupos en confirmación
- **WHEN** paciente confirma cita en paso 3 y `bookedCount >= slotCapacity` para ese `scheduleId` + `date`
- **THEN** backend rechaza con HTTP 409 y mensaje "Horario completo. No hay cupos disponibles para ese horario"
- **THEN** frontend muestra error y vuelve al paso 1 con disponibilidad actualizada

#### Scenario: Concurrencia — dos pacientes al mismo tiempo
- **WHEN** dos pacientes confirman el último cupo simultáneamente en paso 3
- **THEN** solo una cita se crea (transacción atómica con bloqueo optimista en `Schedule.version`)
- **AND** el otro recibe error "Horario completo" y vuelve al selector de fecha con disponibilidad actualizada

#### Scenario: Agenda semanal excluye horarios sin cupo del día actual
- **WHEN** se renderiza WeeklyScheduleList para fecha actual (hoy)
- **THEN** horarios con `available=0` para hoy muestran `[Completo]` disabled
- **AND** horarios con `available>0` muestran cupos reales y `[Seleccionar]` habilitado

#### Scenario: Selector fecha muestra cupos reales por día
- **WHEN** paciente ve lista de fechas en DatePickerWithAvailability
- **THEN** cada fila muestra `available` y `total` reales para ese `scheduleId` + `date`
- **AND** filas con `available=0` atenuadas, `[Completo]` disabled

#### Scenario: Backend rechaza reserva si no hay cupos en confirmación (con optimistic lock)
- **WHEN** paciente confirma cita en paso 3 y `bookedCount >= slotCapacity` para ese `scheduleId` + `date`
- **THEN** backend rechaza con HTTP 409 y mensaje "Horario completo. No hay cupos disponibles para ese horario"
- **AND** si contienda concurrente: optimistic lock en `Schedule.version` detecta conflicto, retorna error `CONCURRENT_BOOKING`, frontend reintenta (máx 3× con backoff)
- **AND** frontend muestra error y vuelve a selector de fecha con disponibilidad actualizada

### Requirement: Crear cita con posición asignada mediante wizard de 2 pasos

El sistema SHALL crear la cita con una posición única dentro del horario para esa fecha, tras confirmación explícita en un wizard de tres pasos: especialidad → doctor/agenda → confirmar.

#### Scenario: Paso 1 - Selección completa habilita paso 2
- **WHEN** paciente ha seleccionado: doctor, fecha, y un horario con cupo libre
- **THEN** botón "Revisar y confirmar" se habilita
- **AND** faltando cualquiera, botón permanece deshabilitado

#### Scenario: Paso 2 - Resumen de confirmación antes de crear
- **WHEN** paciente avanza al paso 3
- **THEN** se muestra resumen con: nombre del doctor, especialidad, fecha formateada, hora inicio/fin, cupos disponibles
- **AND** botones: "Confirmar Cita" (primario) y "Volver" (secundario)

#### Scenario: Confirmación crea cita con posición atómica
- **WHEN** paciente hace click en "Confirmar Cita" en el paso 3
- **THEN** sistema crea la cita vía API (transacción atómica con optimistic lock en `Schedule.version`)
- **AND** asigna `posicion = cupos_ocupados + 1`
- **AND** muestra estado de éxito con número de posición
- **AND** actualiza vista a "Mis Citas" con la nueva cita visible

### Requirement: Validaciones de integridad en wizard

El sistema SHALL rechazar reservas que violen restricciones del modelo, validando en los pasos del wizard: overlap de horarios, ventana antelación, límites por paciente, duplicados.

#### Scenario: Horario inactivo no seleccionable
- **WHEN** un `HorarioAtencion` tiene `estado = inactivo`
- **THEN** no aparece en cards de doctores ni en panel de horarios

#### Scenario: Paciente inexistente
- **WHEN** se intenta crear cita con `idPaciente` que no existe (sesión inválida)
- **THEN** sistema rechaza con error "Paciente no encontrado" y redirige a login

#### Scenario: Fecha pasada no seleccionable en calendario
- **WHEN** paciente navega a mes anterior o hace click en día anterior a hoy
- **THEN** días pasados lucen deshabilitados y no son seleccionables

#### Scenario: Overlap de horarios mismo día bloqueado
- **WHEN** paciente con cita confirmada `09:00-10:00` intenta agendar `09:30-10:30` misma fecha
- **THEN** sistema rechaza con error `OVERLAP_CONFLICT` "Ya tiene una cita que se solapa en ese horario"

#### Scenario: Ventana antelación 2h-60d validada
- **WHEN** paciente intenta agendar con <2h o >60d antelación
- **THEN** sistema rechaza con error `INVALID_ADVANCE`

#### Scenario: Límites 1/día 2/semana por paciente
- **WHEN** paciente excede límite diario o semanal
- **THEN** sistema rechaza con error `DAILY_LIMIT_EXCEEDED` o `WEEKLY_LIMIT_EXCEEDED`
- **AND** excepción admin registrada en auditoría permite exceder

#### Scenario: Duplicado exacto rechazado
- **WHEN** request duplicado (mismo paciente + scheduleId + date)
- **THEN** sistema rechaza con error `DUPLICATE_APPOINTMENT`

### Requirement: Cancelar cita libera cupo

El sistema SHALL permitir cancelar citas y liberar el cupo correspondiente, decrementando contadores de límites del paciente.

#### Scenario: Cancelación exitosa
- **WHEN** paciente cancela su cita confirmada desde "Mis Citas"
- **THEN** cita cambia a estado `CANCELLED`
- **AND** cupo queda disponible para nuevos pacientes en el calendario y cards

#### Scenario: Cancelación de cita ya cancelada
- **WHEN** se intenta cancelar una cita ya en estado `cancelada`
- **THEN** sistema rechaza con error "Cita ya cancelada"

### Requirement: Security validations en flujo de agendamiento

El sistema SHALL validar seguridad en el flujo de agendamiento protegiendo contra vulnerabilidades OWASP Top 10 y API Top 10.

#### Scenario: Rate limiting en búsqueda de disponibilidad
- **WHEN** paciente hace requests repetidos a `/schedules/availability` en ventana corta
- **THEN** sistema responde con HTTP 429 y header `Retry-After`
- **AND** no bloquea usuario legítimo (límite razonable: 30 req/min)

#### Scenario: Input sanitization en búsqueda de doctor
- **WHEN** paciente inyecta payload XSS en input búsqueda (ej. `<script>alert(1)</script>`)
- **THEN** sistema sanitiza input y no ejecuta script
- **AND** búsqueda trata payload como texto literal, no como HTML/JS

#### Scenario: Authorization check en creación de cita
- **WHEN** request a `/appointments` POST sin token válido o token de otro paciente
- **THEN** sistema rechaza con HTTP 401/403
- **AND** no crea cita ni filtra información de otros pacientes

#### Scenario: CSRF protection en wizard
- **WHEN** request POST a `/appointments` sin CSRF token válido (SameSite cookie + header)
- **THEN** sistema rechaza con HTTP 403
- **AND** wizard incluye CSRF token en form submission

### Requirement: Deployment readiness

El sistema SHALL ser deployable automáticamente a Vercel (frontend) y Render (backend) via GitHub Actions on push to main.

#### Scenario: Frontend deploy a Vercel
- **WHEN** push a branch `main` en GitHub
- **THEN** GitHub Actions ejecuta job `deploy-frontend` con Vercel CLI
- **THEN** build Next.js exitoso (`npm run build`)
- **THEN** deploy a `https://web-alpha-ecru-99.vercel.app` con alias de producción
- **THEN** página `/citas/agendar` accesible y funcional en producción

#### Scenario: Backend deploy a Render
- **WHEN** push a branch `main` en GitHub
- **THEN** GitHub Actions ejecuta job `deploy-backend` (Render Deploy Hook o render.yaml sync)
- **THEN** build backend exitoso usando `Dockerfile` (Render detecta y usa Dockerfile automáticamente)
- **THEN** servicio `medicitas-api` reiniciado en `https://medicitas-api.onrender.com` con `autoDeploy: true`
- **THEN** health check `/health` responde 200 OK
- **THEN** endpoints `/schedules/availability`, `/appointments` funcionales
- **WHEN** error en deploy en Render
- **THEN** notificar al usuario y consultar opciones de arreglo (sin eliminar Dockerfile ni estructura render.yaml)

#### Scenario: Deploy order y rollback
- **WHEN** ambos jobs completan exitosamente
- **THEN** deployment marcado como éxito en GitHub Actions
- **WHEN** fallback: frontend deploy falla
- **THEN** job `deploy-backend` ya completado no se revierte (idempotente)
- **WHEN** rollback manual: `git revert` + push → nuevo deploy automático

## REMOVED Requirements

### Requirement: Calendario interactivo mensual standalone en wizard

**Reason**: Reemplazado por DatePickerWithAvailability dentro de ScheduleDialog (vista 2), que muestra grid mes + lista cupos contextualizada al horario seleccionado.

**Migration**: Eliminar componente `MonthCalendar` y hook `useAvailabilityByDateRange`. Usar `ScheduleDialog` + `DatePickerWithAvailability`.

### Requirement: Panel de horarios lateral en wizard

**Reason**: Reemplazado por flujo en ScheduleDialog: selección de horario en Vista 1 → selección de fecha en Vista 2 → confirmación.

**Migration**: Eliminar renderizado condicional de panel horarios en `agendar-wizard.tsx`. La lista de horarios ahora vive en WeeklyScheduleList.

### Requirement: Doctor card muestra "Próximo: HH-HH · N cupos"

**Reason**: Reemplazado por resumen semanal "Lun-Vie 08-12, 14-17 | Sáb 09-13" + badge "3 horarios · 8 cupos próximo" + botón `[Ver agenda]`. El "próximo" específico inducía a error si el paciente quería otro día.

**Migration**: Actualizar `DoctorCard` props y renderizado. Nuevo prop `availabilitySummary` con `nextSlot` y `totalSlotsThisMonth`.