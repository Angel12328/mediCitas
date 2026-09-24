## MODIFIED Requirements

### Requirement: Gestión de estado de citas
El sistema SHALL rastrear ciclo de vida de citas a través de estados definidos, incluyendo transición PENDING → CONFIRMED iniciada por doctor.

#### Scenario: Confirmar cita
- **WHEN** doctor/admin confirma cita pendiente
- **THEN** sistema actualiza estado a "confirmada"

#### Scenario: Completar cita
- **WHEN** cita concluye
- **THEN** sistema actualiza estado a "completada"

#### Scenario: Cancelar cita
- **WHEN** paciente o doctor cancela cita
- **THEN** sistema actualiza estado a "cancelada" y libera capacidad del cupo

#### Scenario: Manejo de no presentación
- **WHEN** paciente no se presenta a cita
- **THEN** sistema actualiza estado a "no-show"

#### Scenario: Doctor confirma llegada de paciente (PENDING → CONFIRMED)
- **WHEN** doctor (dueño del horario) usa acción confirmar en cita PENDING
- **THEN** sistema actualiza estado a CONFIRMED; transición solo permitida a STAFF (DOCTOR/Admin)

### Requirement: Listado y filtrado de citas
El sistema SHALL proveer vistas filtradas de citas para diferentes roles, incluyendo agenda agrupada por horarios para doctores.

#### Scenario: Paciente ve sus propias citas
- **WHEN** paciente solicita citas
- **THEN** sistema devuelve solo sus citas con detalles completos

#### Scenario: Doctor ve agenda diaria
- **WHEN** doctor solicita citas para fecha
- **THEN** sistema devuelve citas para ese doctor en esa fecha

#### Scenario: Admin ve todas las citas
- **WHEN** admin solicita citas con filtros
- **THEN** sistema devuelve resultados filtrados entre todos los doctores/pacientes

#### Scenario: Doctor obtiene agenda agrupada por horarios
- **WHEN** doctor solicita `/me/agenda?date=YYYY-MM-DD`
- **THEN** sistema devuelve horarios con citas anidadas, cupos, y disponibilidad por horario

### Requirement: Creación de cita de seguimiento (follow-up)
El sistema SHALL permitir crear citas de control independientes a partir de citas completadas, preservando la original.

#### Scenario: Crear cita de control desde cita COMPLETED
- **WHEN** doctor invoca POST /appointments/follow-up con referencia a cita COMPLETED
- **THEN** sistema crea nueva cita PENDING para mismo paciente; cita original permanece COMPLETED

#### Scenario: Validaciones de reserva aplican a follow-up
- **WHEN** se crea cita de control
- **THEN** sistema valida: horario activo y día correcto, cupo disponible, sin solapamiento paciente, ventana 2h–60d

#### Scenario: Observaciones clínicas se copian opcionalmente
- **WHEN** cita original tiene observaciones
- **THEN** nueva cita incluye observación con prefijo "Control: "