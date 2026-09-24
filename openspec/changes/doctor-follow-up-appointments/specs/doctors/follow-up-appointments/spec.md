## Purpose

Permite a los doctores crear citas de control (seguimiento) para pacientes después de atenderlos, manteniendo la cita original completada intacta y filtrando horarios disponibles por la especialidad de la consulta original.

## ADDED Requirements

### Requirement: Doctor ve agenda diaria agrupada por horarios
El sistema SHALL presentar la agenda del día organizada por bloques de horario (Schedule) del doctor, mostrando especialidad, cupos ocupados/disponibles y pacientes por posición.

#### Scenario: Ver agenda diaria agrupada
- **WHEN** doctor accede a `/agenda` con fecha seleccionada
- **THEN** sistema muestra cada horario activo del doctor para ese día como sección separada con: nombre de especialidad, rango horario, cupos (X/Y), y tabla de pacientes por posición

#### Scenario: Horario sin pacientes muestra cupos libres
- **WHEN** horario tiene menos pacientes que capacidad
- **THEN** sistema muestra filas vacías etiquetadas "Cupo libre" para posiciones sin cita

### Requirement: Acciones contextuales por estado de cita
El sistema SHALL exponer acciones relevantes según el estado actual de la cita en la agenda.

#### Scenario: Cita PENDING muestra Confirmar como acción principal
- **WHEN** cita está en estado PENDING
- **THEN** botón principal muestra "Confirmar" (transición a CONFIRMED) y menú incluye "No asistió"

#### Scenario: Cita CONFIRMED muestra Atendido como acción principal
- **WHEN** cita está en estado CONFIRMED
- **THEN** botón principal muestra "Atendido" (transición a COMPLETED) y menú incluye "No asistió"

#### Scenario: Cita COMPLETED muestra solo Agendar control
- **WHEN** cita está en estado COMPLETED
- **THEN** no hay botón principal de estado; menú muestra solo "Agendar control"

#### Scenario: Cita NO_SHOW o CANCELLED no muestra acciones de estado
- **WHEN** cita está en estado NO_SHOW o CANCELLED
- **THEN** solo se muestra badge de estado sin acciones de transición

### Requirement: Doctor agenda cita de control desde cita completada
El sistema SHALL permitir al doctor crear una nueva cita de control para el paciente desde una cita en estado COMPLETED, filtrando horarios por la especialidad de la consulta original.

#### Scenario: Abrir modal de cita de control
- **WHEN** doctor selecciona "Agendar control" en cita COMPLETED
- **THEN** sistema abre modal con: nombre del paciente, referencia a cita original (fecha, hora, especialidad), selector de fecha (mañana a +60 días), y lista de horarios disponibles

#### Scenario: Modal filtra horarios por especialidad de cita original
- **WHEN** modal carga horarios para fecha seleccionada
- **THEN** sistema consulta solo horarios del doctor para la especialidad de la cita original (ej. Cardiología) y muestra cupos disponibles

#### Scenario: Horarios de otras especialidades no aparecen
- **WHEN** doctor tiene horarios en múltiples especialidades
- **THEN** modal solo muestra horarios de la especialidad de la cita original

#### Scenario: Crear cita de control genera nueva cita PENDING
- **WHEN** doctor selecciona horario con cupo y confirma
- **THEN** sistema crea nueva cita con estado PENDING para mismo paciente en horario/fecha elegidos; cita original permanece COMPLETED sin cambios

#### Scenario: Validaciones de reserva aplican a cita de control
- **WHEN** doctor intenta agendar control
- **THEN** sistema valida: día en bitmask del horario, cupo disponible, sin solapamiento paciente mismo día, ventana 2h–60d

### Requirement: Transición PENDING → CONFIRMED por doctor
El sistema SHALL permitir al doctor (dueño del horario) confirmar la llegada del paciente, cambiando estado de PENDING a CONFIRMED.

#### Scenario: Doctor confirma llegada de paciente
- **WHEN** doctor usa acción "Confirmar" en cita PENDING de su horario
- **THEN** sistema actualiza estado a CONFIRMED

#### Scenario: Paciente no puede confirmar su propia cita
- **WHEN** paciente intenta cambiar estado de su cita PENDING a CONFIRMED
- **THEN** sistema rechaza (solo STAFF puede confirmar)