## Purpose

Define los componentes UI y comportamiento del wizard de agendamiento rediseñado: cards de doctor con resumen semanal, diálogo de agenda semanal (lista agrupada por días), selector de fecha con grid mes + lista de cupos, y confirmación.

## ADDED Requirements

### Requirement: Doctor Card V2 con resumen semanal y acción "Ver agenda"

El sistema SHALL mostrar en la lista de doctores una card que resume la agenda semanal del doctor y expone botón para abrir el diálogo de horarios.

#### Scenario: Card muestra resumen semanal derivado de horarios
- **WHEN** paciente ve lista de doctores tras seleccionar especialidad
- **THEN** cada card muestra: nombre doctor, especialidad, resumen "Lun-Vie 08-12, 14-17 | Sáb 09-13" (agrupa horarios por `daysBitmask` idéntico)
- **AND** badge "3 horarios · 8 cupos próximo" (conteo schedules + próximo slot con cupo)
- **AND** botón primario `[Ver agenda]` en lugar de selección directa

#### Scenario: Card disabled si doctor sin horarios (filtrado backend)
- **WHEN** doctor no tiene schedules `ACTIVE` para la especialidad
- **THEN** doctor NO aparece en la lista (filtrado en backend `EXISTS schedule`)

#### Scenario: Card disabled si doctor sin cupos próximos 30 días
- **WHEN** doctor tiene horarios pero `availabilitySummary.hasAvailabilityThisMonth=false`
- **THEN** card aparece con estado disabled, texto "Sin disponibilidad próximas 4 semanas", botón `[Ver agenda]` deshabilitado

#### Scenario: Click en [Ver agenda] abre ScheduleDialog
- **WHEN** paciente clica `[Ver agenda]` en card habilitada
- **THEN** se abre `ScheduleDialog` con `doctorId`, `specialtyId` preseleccionados
- **AND** vista inicial = WeeklyScheduleList (lista agrupada por días)

### Requirement: ScheduleDialog — Diálogo responsive con dos vistas

El sistema SHALL presentar un diálogo que alterna entre vista semanal (lista de horarios) y vista selector de fecha (grid mes + lista cupos), con header/footer sticky en móvil.

#### Scenario: Vista 1 — WeeklyScheduleList (lista agrupada por días)
- **WHEN** ScheduleDialog se abre
- **THEN** muestra lista de horarios del doctor para la especialidad, agrupados por `daysBitmask`:
  - Header "Lunes – Viernes" (o "Sábado", "Domingo", "Lunes – Miércoles", etc.)
  - Cada horario = fila con: ícono franja (☀/🌤/🌙), rango "08:00–12:00", cupos "8/10", botón `[Seleccionar]`
  - Horarios con `available=0` muestran `[Completo]` disabled
- **AND** header del diálogo: "Dr. García — Cardiología" + botón `[Volver]` (cierra diálogo)

#### Scenario: Vista 2 — DatePickerWithAvailability (grid mes + lista cupos)
- **WHEN** paciente clica `[Seleccionar]` en un horario de WeeklyScheduleList
- **THEN** diálogo cambia a Vista 2 mostrando:
  - Header: "← 08:00–12:00 Lun–Vie · 8 cupos de 10" + botón `[Volver]` (vuelve a Vista 1)
  - Grid mes navegable (react-day-picker o similar): días con ese horario en `daysBitmask` = bold; días pasados = disabled
  - Lista vertical "Fechas disponibles para 08:00–12:00": cada fila = radio + "Lun 8 sep · 08:00–12:00 · 8 cupos de 10" + botón `[Elegir]`
  - Filas con `available=0` = atenuadas, `[Completo]` disabled
  - Fetch on-demand: al navegar mes en grid, carga disponibilidad de ese mes para el `scheduleId` seleccionado
- **AND** footer: `[Cancelar]` + `[Confirmar cita]` (habilitado solo si hay fecha seleccionada)

#### Scenario: Responsive — híbrido desktop/móvil
- **WHEN** viewport ≥ 640px (sm)
- **THEN** diálogo centrado `max-w-lg`, scroll interno
- **WHEN** viewport < 640px
- **THEN** diálogo ancho completo `max-w-full`, header/footer sticky, contenido scrollable

### Requirement: Wizard principal — Flujo 3 pasos

El sistema SHALL orquestar el flujo: Especialidad → Doctor (cards) → ScheduleDialog → ConfirmDialog.

#### Scenario: Paso 1 — Selección de especialidad
- **WHEN** paciente entra a `/citas/agendar`
- **THEN** muestra dropdown "Especialidad" + input "Buscar doctor" (deshabilitado sin especialidad)
- **AND** al seleccionar especialidad → carga doctores (usa `useDoctores` con `withAvailability=true`)

#### Scenario: Paso 2 — Selección de doctor + agenda
- **WHEN** paciente clica `[Ver agenda]` en card
- **THEN** abre ScheduleDialog
- **AND** al seleccionar horario + fecha en ScheduleDialog → cierra diálogo, actualiza wizard con `doctorId`, `scheduleId`, `date`
- **AND** botón "Revisar y confirmar" se habilita

#### Scenario: Paso 3 — Confirmación
- **WHEN** paciente clica "Revisar y confirmar"
- **THEN** abre `ConfirmDialog` con resumen: doctor, especialidad, fecha, hora, cupos
- **AND** clic "Confirmar Cita" → POST `/appointments` → éxito → toast + limpia selección (mantiene especialidad)

### Requirement: Checkbox "Con disponibilidad esta semana"

El sistema SHALL ofrecer filtro visible para mostrar solo doctores con cupos en los próximos 7 días.

#### Scenario: Checkbox filtra lista en tiempo real
- **WHEN** paciente marca `[✓] Con disponibilidad esta semana`
- **THEN** lista de doctors se filtra a `availabilitySummary.hasAvailabilityThisWeek=true`
- **AND** conteo "X doctores encontrados" actualiza
- **AND** si ningún doctor tiene cupo → mensaje "Ningún doctor con disponibilidad esta semana"