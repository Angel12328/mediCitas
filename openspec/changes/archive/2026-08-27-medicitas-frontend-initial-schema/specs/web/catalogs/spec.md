## Purpose

Catálogos compartidos que alimentan los formularios: países/departamentos/municipios, especialidades, extensiones telefónicas y cargos.

## ADDED Requirements

### Requirement: Ubicaciones jerárquicas

El sistema SHALL ofrecer selección de país, departamento y municipio respetando la jerarquía del modelo.

#### Scenario: Consulta de países
- **WHEN** un formulario necesita país
- **THEN** se ofrecen todos los países registrados

#### Scenario: Departamentos dependientes de país
- **WHEN** se selecciona un país
- **THEN** solo se ofrecen sus departamentos

#### Scenario: Municipios dependientes de departamento
- **WHEN** se selecciona un departamento
- **THEN** solo se ofrecen sus municipios

### Requirement: Especialidades activas

El sistema SHALL listar las especialidades activas para formularios de búsqueda y administración.

#### Scenario: Selección de especialidad en agendamiento
- **WHEN** el paciente inicia la búsqueda de citas
- **THEN** se listan únicamente especialidades activas

### Requirement: Extensiones telefónicas

El sistema SHALL listar las extensiones activas para formularios de teléfonos.

#### Scenario: Registro de teléfono
- **WHEN** cualquier formulario necesita extensión telefónica
- **THEN** se ofrecen las extensiones activas registradas

### Requirement: Cargos activos

El sistema SHALL listar los cargos activos para la asignación de cargos a empleados.

#### Scenario: Asignación de cargo a empleado
- **WHEN** ADMIN asigna un cargo a un empleado
- **THEN** se ofrecen únicamente los cargos activos

### Requirement: Reutilización de catálogos en sesión

El sistema SHALL reutilizar los catálogos ya consultados durante la sesión en lugar de volver a solicitarlos en cada formulario.

#### Scenario: Navegación entre formularios que usan catálogos
- **WHEN** el usuario pasa de un formulario a otro que usa el mismo catálogo
- **THEN** los datos se sirven de la copia local sin nueva petición por cada apertura
