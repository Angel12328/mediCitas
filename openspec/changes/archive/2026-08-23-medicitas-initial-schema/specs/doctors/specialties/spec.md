## Purpose

Gestiona catálogo de especialidades médicas con seguimiento de estado para disponibilidad en programación.

## ADDED Requirements

### Requirement: Gestión de catálogo de especialidades
El sistema DEBE mantener catálogo de especialidades médicas con estado activo/inactivo.

#### Scenario: Crear especialidad
- **WHEN** admin agrega nueva especialidad médica
- **THEN** sistema crea especialidad con nombre y estado activo

#### Scenario: Listar especialidades
- **WHEN** usuario solicita lista de especialidades
- **THEN** sistema devuelve todas las especialidades con nombre y estado

#### Scenario: Filtrar especialidades activas
- **WHEN** usuario solicita especialidades activas para programación
- **THEN** sistema devuelve solo especialidades con estado activo

### Requirement: Control de estado de especialidad
El sistema DEBE permitir activación/desactivación de especialidades.

#### Scenario: Desactivar especialidad
- **WHEN** admin desactiva especialidad
- **THEN** especialidad ya no aparece en opciones de programación pero asignaciones existentes se preservan

#### Scenario: Reactivar especialidad
- **WHEN** admin reactiva especialidad
- **THEN** especialidad queda disponible para nuevas asignaciones de horarios