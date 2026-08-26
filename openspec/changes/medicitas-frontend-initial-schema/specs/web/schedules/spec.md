## Purpose

Administración de horarios de atención: creación, edición, listado y activación/desactivación de franjas por doctor y especialidad, con días, rango horario y cupos.

## ADDED Requirements

### Requirement: Creación de franja de atención

El sistema SHALL permitir crear una franja de atención indicando doctor, especialidad, días de la semana (0 = domingo a 6 = sábado), hora inicio, hora fin y número de cupos.

#### Scenario: Franja válida creada
- **WHEN** ADMIN registra una franja con hora fin posterior a hora inicio y cupos mayores a cero
- **THEN** la franja queda creada y activa

#### Scenario: Rango horario inválido
- **WHEN** ADMIN registra una franja con hora fin igual o anterior a la hora inicio
- **THEN** se muestra error de validación y no se crea

#### Scenario: Cupos inválidos
- **WHEN** ADMIN registra una franja con cupos cero o negativos
- **THEN** se muestra error de validación y no se crea

### Requirement: Listado de horarios filtrable

El sistema SHALL listar las franjas filtrando por doctor, especialidad y estado.

#### Scenario: Filtro por doctor
- **WHEN** se consulta el listado filtrando por un doctor
- **THEN** se muestran todas sus franjas con días, rango horario, cupos y observaciones

#### Scenario: Filtro por especialidad
- **WHEN** se consulta el listado filtrando por una especialidad
- **THEN** se muestran solo las franjas de esa especialidad

### Requirement: Edición de franja

El sistema SHALL permitir editar días, horas, cupos y observación de una franja existente.

#### Scenario: Reducción de cupos permitida
- **WHEN** ADMIN reduce el número de cupos a un valor mayor o igual a los ya reservados
- **THEN** el cambio se guarda

#### Scenario: Reducción de cupos bajo reservas existentes
- **WHEN** ADMIN intenta fijar cupos menores a las citas ya reservadas en la franja
- **THEN** se muestra error explicativo y el cambio no se aplica

### Requirement: Activación y desactivación de franja

El sistema SHALL permitir activar y desactivar franjas.

#### Scenario: Desactivación de franja
- **WHEN** ADMIN desactiva una franja
- **THEN** deja de ofrecerse en nuevas búsquedas de disponibilidad

#### Scenario: Reactivación de franja
- **WHEN** ADMIN activa nuevamente una franja
- **THEN** vuelve a ofrecerse en las búsquedas de disponibilidad
