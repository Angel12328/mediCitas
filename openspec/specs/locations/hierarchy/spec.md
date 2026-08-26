# locations/hierarchy Specification

## Purpose


Gestiona jerarquía geográfica de ubicaciones (País → Departamento → Municipio) para registro de direcciones de personas y filtrado.

## Requirements

### Requirement: Gestión de países
El sistema SHALL mantener catálogo de países.

#### Scenario: Listar países
- **WHEN** usuario solicita lista de países
- **THEN** sistema devuelve todos los países con nombres

#### Scenario: Crear país
- **WHEN** admin agrega nuevo país
- **THEN** sistema crea registro de país

### Requirement: Gestión de departamentos
El sistema SHALL gestionar departamentos/estados/provincias dentro de países.

#### Scenario: Listar departamentos por país
- **WHEN** usuario solicita departamentos para país
- **THEN** sistema devuelve departamentos pertenecientes a ese país

#### Scenario: Crear departamento
- **WHEN** admin agrega departamento a país
- **THEN** sistema crea departamento vinculado a país

### Requirement: Gestión de municipios
El sistema SHALL gestionar municipios/ciudades dentro de departamentos.

#### Scenario: Listar municipios por departamento
- **WHEN** usuario solicita municipios para departamento
- **THEN** sistema devuelve municipios pertenecientes a ese departamento

#### Scenario: Crear municipio
- **WHEN** admin agrega municipio a departamento
- **THEN** sistema crea municipio vinculado a departamento

### Requirement: Navegación de jerarquía de ubicaciones
El sistema SHALL soportar recorrido completo de jerarquía.

#### Scenario: Obtener ruta completa de ubicación
- **WHEN** usuario solicita detalles de ubicación para municipio
- **THEN** sistema devuelve municipio con departamento padre y país