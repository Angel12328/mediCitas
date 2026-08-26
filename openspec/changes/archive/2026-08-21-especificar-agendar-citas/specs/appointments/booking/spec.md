## Purpose

Define el flujo completo de reserva de citas médicas: paciente elige especialidad, doctor, horario y fecha; el sistema valida disponibilidad en tiempo real y crea la cita con una posición de cupo asignada.

## ADDED Requirements

### Requirement: Paciente busca horarios disponibles

El sistema SHALL permitir buscar horarios de atención filtrando por especialidad, doctor y/o fecha.

#### Scenario: Búsqueda por especialidad y fecha
- **WHEN** paciente selecciona una especialidad y una fecha
- **THEN** sistema devuelve todos los `HorarioAtencion` activos de doctores con esa especialidad que atienden ese día de la semana
- **AND** cada horario muestra `hora_inicio`, `hora_fin`, `numeroCupos` y cupos ya ocupados para esa fecha

#### Scenario: Búsqueda por doctor específico
- **WHEN** paciente selecciona un doctor y una fecha
- **THEN** sistema devuelve solo los `HorarioAtencion` de ese doctor para la fecha dada

### Requirement: Sistema valida disponibilidad de cupos

El sistema SHALL validar que existan cupos libres antes de confirmar una cita.

#### Scenario: Cupo disponible
- **WHEN** paciente intenta reservar un horario con `cupos_ocupados < numeroCupos` para la fecha
- **THEN** sistema permite crear la cita
- **AND** asigna `posicion = cupos_ocupados + 1`

#### Scenario: Sin cupos disponibles
- **WHEN** paciente intenta reservar un horario con `cupos_ocupados >= numeroCupos` para la fecha
- **THEN** sistema rechaza la reserva con error "Horario completo"
- **AND** no crea ninguna cita

### Requirement: Crear cita con posición asignada

El sistema SHALL crear la cita con una posición única dentro del horario para esa fecha.

#### Scenario: Primera cita del día en ese horario
- **WHEN** se crea la primera cita para un `HorarioAtencion` y fecha
- **THEN** `posicion = 1`

#### Scenario: Cita subsecuente
- **WHEN** se crea una cita y ya existen N citas para ese horario y fecha
- **THEN** `posicion = N + 1`

#### Scenario: Concurrencia — dos pacientes al mismo tiempo
- **WHEN** dos pacientes intentan reservar el último cupo simultáneamente
- **THEN** solo una cita se crea (transacción atómica)
- **AND** el otro recibe error "Horario completo"

### Requirement: Validaciones de integridad

El sistema SHALL rechazar reservas que violen restricciones del modelo.

#### Scenario: Horario inactivo
- **WHEN** paciente intenta reservar un `HorarioAtencion` con `estado = inactivo`
- **THEN** sistema rechaza con error "Horario no disponible"

#### Scenario: Paciente inexistente
- **WHEN** se intenta crear cita con `idPaciente` que no existe
- **THEN** sistema rechaza con error "Paciente no encontrado"

#### Scenario: Fecha pasada
- **WHEN** paciente intenta reservar para una fecha anterior a hoy
- **THEN** sistema rechaza con error "Fecha inválida"

### Requirement: Cancelar cita libera cupo

El sistema SHALL permitir cancelar citas y liberar el cupo correspondiente.

#### Scenario: Cancelación exitosa
- **WHEN** paciente cancela su cita confirmada
- **THEN** cita cambia a estado `cancelada`
- **AND** cupo queda disponible para nuevos pacientes

#### Scenario: Cancelación de cita ya cancelada
- **WHEN** se intenta cancelar una cita ya en estado `cancelada`
- **THEN** sistema rechaza con error "Cita ya cancelada"