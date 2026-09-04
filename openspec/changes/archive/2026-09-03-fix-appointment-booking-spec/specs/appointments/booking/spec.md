## MODIFIED Requirements

### Requirement: Paciente busca horarios disponibles

El sistema SHALL permitir buscar horarios de atención filtrando por especialidad, doctor y/o fecha, con una interfaz que incluya cards visuales de doctores, calendario interactivo mensual, y filtros separados.

#### Scenario: Búsqueda por especialidad y fecha con cards de doctores
- **WHEN** paciente selecciona una especialidad en el dropdown de filtros
- **THEN** sistema muestra un grid de cards de doctores con esa especialidad activa
- **AND** cada card muestra: nombre del doctor, especialidad, y próximo horario disponible con cupos libres (`available = slotCapacity - bookedCount`)
- **AND** paciente puede seleccionar un doctor haciendo click en su card

#### Scenario: Búsqueda por doctor específico con búsqueda por nombre
- **WHEN** paciente escribe en el input de búsqueda por nombre de doctor
- **THEN** sistema filtra las cards en tiempo real coincidiendo con nombre completo
- **AND** dropdown de especialidad se resetea a "Todas"
- **WHEN** paciente selecciona un doctor de las cards filtradas y una fecha en el calendario
- **THEN** sistema devuelve solo los `HorarioAtencion` de ese doctor para la fecha dada

#### Scenario: Calendario interactivo muestra disponibilidad por día
- **WHEN** paciente navega el calendario mensual
- **THEN** para cada día:
  - **SI** día no está en `daysBitmask` de **ninguna** franja del doctor/especialidad → deshabilitado (médico no atiende ese día)
  - **SI** día está en `daysBitmask` de al menos una franja PERO **todas** tienen `available = 0` → "Sin cupos" (atende pero lleno)
  - **SI** día está en `daysBitmask` Y al menos una franja tiene `available > 0` → "Disponible" (indicador verde)
- **WHEN** paciente hace click en una fecha con disponibilidad
- **THEN** fecha se marca como seleccionada y panel de horarios se actualiza para esa fecha

#### Scenario: Fecha pasada no seleccionable en calendario
- **WHEN** paciente navega a mes anterior o hace click en día anterior a hoy
- **THEN** días pasados lucen deshabilitados y no son seleccionables (independiente de `daysBitmask`)

### Requirement: Sistema valida disponibilidad de cupos

El sistema SHALL validar que existan cupos libres **en la franja horaria específica** (Schedule/HorarioAtencion) para la fecha consultada antes de mostrar el horario como disponible o permitir la reserva.

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
- **WHEN** paciente confirma cita en paso 2 y `bookedCount >= slotCapacity` para ese `scheduleId` + `date`
- **THEN** backend rechaza con HTTP 409 y mensaje "Horario completo. No hay cupos disponibles para ese horario"
- **THEN** frontend muestra error y vuelve al paso 1 con disponibilidad actualizada

#### Scenario: Concurrencia — dos pacientes al mismo tiempo
- **WHEN** dos pacientes confirman el último cupo simultáneamente en paso 2
- **THEN** solo una cita se crea (transacción atómica con bloqueo optimista en `Schedule.version`)
- **AND** el otro recibe error "Horario completo" y vuelve al paso 1 con disponibilidad actualizada