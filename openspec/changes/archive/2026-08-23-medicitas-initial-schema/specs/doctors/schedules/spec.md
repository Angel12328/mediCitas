## Purpose

Gestiona horarios de disponibilidad de doctores por especialidad con franjas horarias, capacidad y patrones de recurrencia para reserva de citas.

## ADDED Requirements

### Requirement: Creación de horarios
El sistema DEBE crear horarios recurrentes para doctores por especialidad con días, horas y capacidad.

#### Scenario: Crear horario semanal
- **WHEN** admin crea horario para doctor/especialidad con días, horas inicio/fin y capacidad de cupos
- **THEN** sistema crea registro de horario con parámetros especificados

#### Scenario: Validar conflictos de horario
- **WHEN** creando horario que se superpone con horario existente para mismo doctor/especialidad
- **THEN** sistema rechaza con error de conflicto

### Requirement: Consulta de disponibilidad de horarios
El sistema DEBE proveer franjas horarias disponibles para reserva basándose en horarios.

#### Scenario: Obtener cupos disponibles
- **WHEN** paciente solicita cupos disponibles para doctor/especialidad/fecha
- **THEN** sistema devuelve franjas horarias con capacidad restante

#### Scenario: Excluir cupos reservados
- **WHEN** cupos están completamente reservados
- **THEN** sistema los excluye de resultados disponibles

### Requirement: Modificación de horarios
El sistema DEBE permitir modificación de parámetros de horarios.

#### Scenario: Actualizar horas de horario
- **WHEN** admin actualiza horas o días de horario
- **THEN** sistema actualiza horario y disponibilidad futura refleja cambios

#### Scenario: Desactivar horario
- **WHEN** admin desactiva horario
- **THEN** horario ya no genera cupos disponibles pero citas existentes se preservan

### Requirement: Observaciones de horarios
El sistema DEBE soportar notas/observaciones opcionales en horarios.

#### Scenario: Agregar observación a horario
- **WHEN** admin agrega observación a horario
- **THEN** observación almacenada y visible en detalles de horario