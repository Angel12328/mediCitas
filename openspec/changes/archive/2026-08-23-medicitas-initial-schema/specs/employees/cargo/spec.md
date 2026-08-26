## Purpose

Gestiona puestos/cargos para empleados con seguimiento de estado e historial de asignaciones.

## ADDED Requirements

### Requirement: Gestión de catálogo de cargos
El sistema DEBE mantener catálogo de puestos de trabajo con estado activo/inactivo.

#### Scenario: Crear cargo
- **WHEN** admin agrega nuevo puesto de trabajo
- **THEN** sistema crea cargo con nombre y estado activo

#### Scenario: Listar cargos
- **WHEN** usuario solicita lista de cargos
- **THEN** sistema devuelve todos los cargos con nombre y estado

#### Scenario: Filtrar cargos activos
- **WHEN** usuario solicita cargos activos para asignación
- **THEN** sistema devuelve solo cargos con estado activo

### Requirement: Asignación Empleado-Cargo
El sistema DEBE asignar cargos a empleados con seguimiento de timestamp.

#### Scenario: Asignar cargo a empleado
- **WHEN** admin asigna cargo a empleado
- **THEN** sistema crea asignación con timestamp de registro

#### Scenario: Ver historial de cargos de empleado
- **WHEN** usuario solicita historial de cargos para empleado
- **THEN** sistema devuelve todas las asignaciones con fechas

#### Scenario: Actualizar asignación de cargo
- **WHEN** admin cambia cargo de empleado
- **THEN** sistema crea nuevo registro de asignación preservando historial