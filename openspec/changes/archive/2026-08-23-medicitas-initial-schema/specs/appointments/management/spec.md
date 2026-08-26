## Purpose

Gestiona reserva de citas, seguimiento de estado, posicionamiento en cola y cancelación para pacientes con doctores.

## ADDED Requirements

### Requirement: Reserva de citas
El sistema DEBE permitir a pacientes reservar citas en franjas horarias disponibles.

#### Scenario: Reservar cita
- **WHEN** paciente selecciona cupo disponible y confirma
- **THEN** sistema crea cita con estado "pendiente" o "confirmada" y asigna posición en cola

#### Scenario: Prevenir doble reserva
- **WHEN** paciente intenta reservar cita que se superpone
- **THEN** sistema rechaza con error de conflicto

#### Scenario: Aplicación de capacidad
- **WHEN** cupo alcanza capacidad máxima
- **THEN** sistema marca cupo como no disponible para más reservas

### Requirement: Gestión de estado de citas
El sistema DEBE rastrear ciclo de vida de citas a través de estados definidos.

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

### Requirement: Listado y filtrado de citas
El sistema DEBE proveer vistas filtradas de citas para diferentes roles.

#### Scenario: Paciente ve sus propias citas
- **WHEN** paciente solicita citas
- **THEN** sistema devuelve solo sus citas con detalles completos

#### Scenario: Doctor ve agenda diaria
- **WHEN** doctor solicita citas para fecha
- **THEN** sistema devuelve citas para ese doctor en esa fecha

#### Scenario: Admin ve todas las citas
- **WHEN** admin solicita citas con filtros
- **THEN** sistema devuelve resultados filtrados entre todos los doctores/pacientes

### Requirement: Observaciones de citas
El sistema DEBE soportar notas opcionales en citas.

#### Scenario: Agregar observación
- **WHEN** doctor/paciente agrega observación a cita
- **THEN** sistema almacena observación vinculada a cita