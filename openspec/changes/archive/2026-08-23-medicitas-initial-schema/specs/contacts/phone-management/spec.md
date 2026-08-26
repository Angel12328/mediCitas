## Purpose

Gestiona números de teléfono con extensiones para personas, soportando múltiples números por persona y asignación de extensiones.

## ADDED Requirements

### Requirement: Gestión de números de teléfono
El sistema DEBE almacenar números de teléfono vinculados a personas con extensiones opcionales.

#### Scenario: Agregar número de teléfono
- **WHEN** usuario agrega número de teléfono para persona
- **THEN** sistema almacena número con vinculación a persona y extensión opcional

#### Scenario: Listar teléfonos de persona
- **WHEN** usuario solicita teléfonos para persona
- **THEN** sistema devuelve todos los números de teléfono con extensiones

### Requirement: Gestión de extensiones
El sistema DEBE mantener catálogo de extensiones con estado.

#### Scenario: Crear extensión
- **WHEN** admin agrega nueva extensión
- **THEN** sistema crea extensión con nombre y estado activo

#### Scenario: Listar extensiones
- **WHEN** usuario solicita lista de extensiones
- **THEN** sistema devuelve todas las extensiones con nombre y estado

#### Scenario: Asignar extensión a teléfono
- **WHEN** usuario vincula extensión a número de teléfono
- **THEN** sistema asocia extensión con registro de teléfono