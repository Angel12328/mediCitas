## Purpose

Flujo de citas por rol: agendamiento del paciente vía Especialidad → Doctor → Horario, cancelación propia, agenda del día para MÉDICO y gestión para ADMIN/SERVICIO AL CLIENTE.

## ADDED Requirements

### Requirement: Agendamiento guiado del paciente

El sistema SHALL guiar al PACIENTE por la secuencia especialidad → doctor → horario disponible → confirmación.

#### Scenario: Selección de especialidad muestra doctores
- **WHEN** el PACIENTE selecciona una especialidad
- **THEN** se listan los doctores activos con esa especialidad

#### Scenario: Selección de doctor muestra horarios
- **WHEN** el PACIENTE selecciona un doctor
- **THEN** se listan sus franjas de atención activas con hora inicio, hora fin y cupos libres por fecha

#### Scenario: Confirmación crea la cita
- **WHEN** el PACIENTE confirma una franja con cupo libre
- **THEN** la cita se crea con estado inicial y posición asignada dentro de la franja

#### Scenario: Franja sin cupos libres
- **WHEN** el PACIENTE intenta confirmar una franja sin cupos libres para esa fecha
- **THEN** se muestra error "Horario completo" y no se crea ninguna cita

### Requirement: Citas propias del paciente

El sistema SHALL permitir al PACIENTE ver sus citas próximas e históricas y cancelar las futuras.

#### Scenario: Cancelación de cita futura
- **WHEN** el PACIENTE cancela una cita futura en estado PA o APUN
- **THEN** la cita queda cancelada y su posición vuelve a estar disponible

#### Scenario: Cita pasada no cancelable
- **WHEN** el PACIENTE intenta cancelar una cita ya ATENDIDA o NO ASISTIDA
- **THEN** la acción no está disponible y no altera la cita

### Requirement: Agenda del día del médico

El sistema SHALL mostrar al MÉDICO las citas de sus franjas de atención ordenadas por fecha y posición.

#### Scenario: Consulta de agenda diaria
- **WHEN** el MÉDICO abre su agenda para una fecha
- **THEN** ve las citas de sus horarios con paciente, posición, hora y observación

#### Scenario: Registro de asistencia
- **WHEN** el MÉDICO marca una cita como ATENDIDA o NO ASISTIDA
- **THEN** el nuevo estado persiste y se refleja en la vista

#### Scenario: Aislamiento entre médicos
- **WHEN** un MÉDICO consulta su agenda
- **THEN** solo ve citas asociadas a sus propios horarios de atención

### Requirement: Gestión de citas por personal

El sistema SHALL permitir a ADMIN y SERVICIO AL CLIENTE listar citas filtrando por fecha, estado, doctor y paciente.

#### Scenario: Listado filtrado
- **WHEN** el personal filtra citas por fecha y estado
- **THEN** solo se muestran las citas que cumplen ambos filtros

#### Scenario: Cancelación administrativa
- **WHEN** ADMIN o SERVICIO AL CLIENTE cancelan una cita futura en nombre del paciente
- **THEN** la cita queda cancelada y el cupo liberado

#### Scenario: Cambio de observación
- **WHEN** el personal guarda una observación sobre una cita
- **THEN** la observación persiste visible en la ficha de la cita
