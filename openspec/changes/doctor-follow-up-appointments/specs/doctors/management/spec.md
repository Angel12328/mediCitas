## MODIFIED Requirements

### Requirement: Listado de doctores
El sistema SHALL proveer listas filtradas de doctores por estado y especialidad, y agenda diaria agrupada por horarios para el doctor autenticado.

#### Scenario: Listar doctores activos
- **WHEN** usuario solicita doctores activos
- **THEN** sistema devuelve doctores con estado activo

#### Scenario: Listar doctores por especialidad
- **WHEN** usuario solicita doctores para especialidad específica
- **THEN** sistema devuelve doctores asignados a esa especialidad

#### Scenario: Doctor ve agenda diaria agrupada por horarios
- **WHEN** doctor autenticado solicita `/me/agenda?date=YYYY-MM-DD`
- **THEN** sistema devuelve horarios activos del doctor para esa fecha agrupados con: specialtyName, startTime, endTime, slotCapacity, bookedCount, y array de appointments con position, patientName, status