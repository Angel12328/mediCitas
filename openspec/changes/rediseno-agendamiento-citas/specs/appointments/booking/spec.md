## MODIFIED Requirements

### Requirement: Paciente busca horarios disponibles

El sistema SHALL permitir buscar horarios de atención filtrando por especialidad y doctor, con una interfaz que incluya cards visuales de doctores con resumen semanal, diálogo de agenda semanal, y selector de fecha con grid mes + lista de cupos.

#### Scenario: Búsqueda por especialidad muestra cards con resumen semanal
- **WHEN** paciente selecciona una especialidad en el dropdown de filtros
- **THEN** sistema muestra un grid de cards de doctores con esa especialidad activa
- **AND** cada card muestra: nombre del doctor, especialidad, resumen semanal "Lun-Vie 08-12, 14-17 | Sáb 09-13", conteo "3 horarios · 8 cupos próximo", y botón `[Ver agenda]`
- **AND** paciente abre la agenda del doctor haciendo click en `[Ver agenda]`

#### Scenario: Búsqueda por doctor específico con búsqueda por nombre
- **WHEN** paciente escribe en el input de búsqueda por nombre de doctor
- **THEN** sistema filtra las cards en tiempo real coincidiendo con nombre completo
- **AND** dropdown de especialidad se resetea a "Todas"

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

#### Scenario: Fecha pasada no seleccionable en grid mes
- **WHEN** paciente navega a mes anterior o día anterior a hoy en grid
- **THEN** días pasados lucen deshabilitados y no son seleccionables

### Requirement: Sistema valida disponibilidad de cupos

El sistema SHALL validar que existan cupos libres en la franja horaria específica para la fecha consultada, usando bloqueo optimista para concurrencia y excluyendo cupos completos de la agenda semanal.

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

### Requirement: Crear cita con posición asignada mediante wizard de 3 pasos

El sistema SHALL crear la cita con una posición única dentro del horario para esa fecha, tras confirmación explícita en un wizard de tres pasos: especialidad → doctor/agenda → confirmar.

#### Scenario: Paso 1 - Selección de especialidad habilita lista doctores
- **WHEN** paciente selecciona especialidad
- **THEN** lista de doctores se carga (con `withAvailability=true`)
- **AND** input búsqueda doctor se habilita

#### Scenario: Paso 2 - Selección de doctor + horario + fecha habilita confirmación
- **WHEN** paciente ha completado: especialidad, doctor (via `[Ver agenda]`), horario (en diálogo), fecha (en selector)
- **THEN** botón "Revisar y confirmar" se habilita
- **AND** faltando cualquiera, botón permanece deshabilitado

#### Scenario: Paso 3 - Resumen de confirmación antes de crear
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

### Requirement: Cancelar cita libera cupo y respeta límites

El sistema SHALL permitir cancelar citas y liberar el cupo correspondiente, decrementando contadores de límites del paciente.

#### Scenario: Cancelación exitosa libera cupo y decrementa límites
- **WHEN** paciente cancela su cita confirmada
- **THEN** cita cambia a estado `CANCELLED`
- **AND** cupo queda disponible en `/availability` y calendario
- **AND** contadores daily/weekly del paciente decrementan

## REMOVED Requirements

### Requirement: Calendario interactivo mensual standalone en wizard

**Reason**: Reemplazado por DatePickerWithAvailability dentro de ScheduleDialog (vista 2), que muestra grid mes + lista cupos contextualizada al horario seleccionado.

**Migration**: Eliminar componente `MonthCalendar` y hook `useAvailabilityByDateRange`. Usar `ScheduleDialog` + `DatePickerWithAvailability`.

### Requirement: Panel de horarios lateral en wizard

**Reason**: Reemplazado por flujo en ScheduleDialog: selección de horario en Vista 1 → selección de fecha en Vista 2 → confirmación.

**Migration**: Eliminar renderizado condicional de panel horarios en `agendar-wizard.tsx`. La lista de horarios ahora vive en WeeklyScheduleList.

### Requirement: Doctor card muestra "Próximo: HH-HH · N cupos"

**Reason**: Reemplazado por resumen semanal "Lun-Vie 08-12, 14-17 | Sáb 09-13" + badge "3 horarios · 8 cupos próximo" + botón `[Ver agenda]`. El "próximo" específico inducía a error si el paciente quería otro día.

**Migration**: Actualizar `DoctorCard` props y renderizado. Nuevo prop `schedules: ScheduleItem[]` para construir resumen.