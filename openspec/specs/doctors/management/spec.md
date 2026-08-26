# doctors/management Specification

## Purpose


Gestiona perfiles de doctores, vinculándolos a registros de empleados y permitiendo asignaciones de especialidades.

## Requirements

### Requirement: Creación de perfil de doctor
El sistema SHALL crear perfiles de doctores vinculados a registros de empleados existentes.

#### Scenario: Crear perfil de doctor
- **WHEN** admin crea perfil de doctor para empleado
- **THEN** sistema vincula doctor a registro de empleado con estado activo

#### Scenario: Prevenir doctor duplicado para empleado
- **WHEN** admin intenta crear segundo perfil de doctor para mismo empleado
- **THEN** sistema rechaza con error apropiado

### Requirement: Gestión de estado de doctor
El sistema SHALL rastrear estado activo/inactivo de doctores.

#### Scenario: Activar doctor
- **WHEN** admin establece estado de doctor a activo
- **THEN** doctor queda disponible para programación y citas

#### Scenario: Desactivar doctor
- **WHEN** admin establece estado de doctor a inactivo
- **THEN** doctor se remueve de programación disponible pero se preserva historial

### Requirement: Listado de doctores
El sistema SHALL proveer listas filtradas de doctores por estado y especialidad.

#### Scenario: Listar doctores activos
- **WHEN** usuario solicita doctores activos
- **THEN** sistema devuelve doctores con estado activo

#### Scenario: Listar doctores por especialidad
- **WHEN** usuario solicita doctores para especialidad específica
- **THEN** sistema devuelve doctores asignados a esa especialidad