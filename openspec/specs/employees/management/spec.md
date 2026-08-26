# employees/management Specification

## Purpose


Gestiona registros de empleados vinculados a cuentas de usuario, sirviendo como puente entre usuarios del sistema y roles profesionales (doctores, personal).

## Requirements

### Requirement: Creación de registro de empleado
El sistema SHALL crear registros de empleados vinculados a cuentas de usuario.

#### Scenario: Crear empleado
- **WHEN** admin crea empleado para usuario existente
- **THEN** sistema vincula empleado a usuario con estado activo

#### Scenario: Prevenir empleado duplicado para usuario
- **WHEN** admin intenta crear segundo empleado para mismo usuario
- **THEN** sistema rechaza con error apropiado

### Requirement: Listado de empleados
El sistema SHALL proveer listas filtradas de empleados.

#### Scenario: Listar todos los empleados
- **WHEN** admin solicita lista de empleados
- **THEN** sistema devuelve todos los empleados con vinculación a usuario

#### Scenario: Filtrar empleados por rol
- **WHEN** admin filtra empleados por rol asignado
- **THEN** sistema devuelve empleados coincidentes