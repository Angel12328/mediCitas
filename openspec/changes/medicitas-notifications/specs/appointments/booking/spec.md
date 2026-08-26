## MODIFIED Requirements

### Requirement: Crear cita con posición asignada

El sistema SHALL crear la cita con una posición única dentro del horario para esa fecha y encolar una notificación de confirmación al paciente.

#### Scenario: Primera cita del día en ese horario
- **WHEN** se crea la primera cita para un `HorarioAtencion` y fecha
- **THEN** `posicion = 1`
- **AND** se encola `appointment_confirmation` para el paciente

#### Scenario: Cita subsecuente
- **WHEN** se crea una cita y ya existen N citas para ese horario y fecha
- **THEN** `posicion = N + 1`
- **AND** se encola `appointment_confirmation` para el paciente

#### Scenario: Concurrencia — dos pacientes al mismo tiempo
- **WHEN** dos pacientes intentan reservar el último cupo simultáneamente
- **THEN** solo una cita se crea (transacción atómica)
- **AND** el otro recibe error "Horario completo"
- **AND** solo la cita creada genera notificación

### Requirement: Cancelar cita libera cupo

El sistema SHALL permitir cancelar citas, liberar el cupo correspondiente y encolar notificación de cancelación.

#### Scenario: Cancelación exitosa
- **WHEN** paciente cancela su cita confirmada
- **THEN** cita cambia a estado `cancelada`
- **AND** cupo queda disponible para nuevos pacientes
- **AND** se encola `appointment_cancelled` para el paciente

#### Scenario: Cancelación de cita ya cancelada
- **WHEN** se intenta cancelar una cita ya en estado `cancelada`
- **THEN** sistema rechaza con error "Cita ya cancelada"
- **AND** no se encola ninguna notificación
