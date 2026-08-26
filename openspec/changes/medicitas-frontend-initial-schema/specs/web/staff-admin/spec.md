## Purpose

Consola de administración (ADMIN): gestión de usuarios y roles con alta manual de cuentas, empleados y sus cargos, doctores y asignación de especialidades.

## ADDED Requirements

### Requirement: Búsqueda y listado de usuarios

El sistema SHALL listar usuarios paginados con búsqueda y filtros por rol y estado.

#### Scenario: Filtro combinado
- **WHEN** ADMIN filtra por rol y estado
- **THEN** se muestran solo los usuarios que cumplen ambos criterios, paginados

#### Scenario: Búsqueda por correo
- **WHEN** ADMIN busca por texto de correo
- **THEN** se muestran los usuarios cuyo correo coincide parcialmente

### Requirement: Alta manual de cuentas

El sistema SHALL permitir a ADMIN crear cuentas manualmente asignando uno o varios roles (pacientes incluidos).

#### Scenario: Creación exitosa de cuenta
- **WHEN** ADMIN registra persona, credenciales y roles válidos
- **THEN** la cuenta queda creada y activa con los roles asignados

#### Scenario: Correo duplicado
- **WHEN** ADMIN usa un correo ya registrado
- **THEN** se muestra error específico y la cuenta no se crea

### Requirement: Activación y desactivación de usuarios

El sistema SHALL permitir a ADMIN activar y desactivar cuentas de usuario.

#### Scenario: Desactivación de cuenta
- **WHEN** ADMIN desactiva un usuario
- **THEN** ese usuario deja de poder iniciar sesión

#### Scenario: Reactivación de cuenta
- **WHEN** ADMIN reactiva un usuario
- **THEN** puede iniciar sesión nuevamente

### Requirement: Gestión de empleados y cargos

El sistema SHALL permitir a ADMIN registrar empleados desde usuarios existentes, asignarles cargos activos y consultar el historial de cargos con su fecha de registro.

#### Scenario: Empleado creado desde usuario
- **WHEN** ADMIN convierte un usuario existente en empleado
- **THEN** el empleado queda vinculado a ese usuario y disponible para ser doctor

#### Scenario: Asignación de cargo
- **WHEN** ADMIN asigna un cargo activo a un empleado
- **THEN** queda registrado con su fecha y aparece en el historial del empleado

### Requirement: Gestión de doctores y especialidades

El sistema SHALL permitir a ADMIN crear doctores desde empleados y asignarles o retirarles especialidades.

#### Scenario: Doctor creado desde empleado
- **WHEN** ADMIN convierte un empleado en doctor
- **THEN** el doctor queda disponible para recibir horarios y especialidades

#### Scenario: Asignación de especialidad
- **WHEN** ADMIN asigna una especialidad activa a un doctor
- **THEN** el doctor aparece en la búsqueda de citas para esa especialidad

#### Scenario: Retiro de especialidad
- **WHEN** ADMIN desactiva la asignación de una especialidad a un doctor
- **THEN** el doctor deja de ofrecerse en nuevas búsquedas de esa especialidad sin perder el historial
