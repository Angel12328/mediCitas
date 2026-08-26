## Purpose

Esqueleto de la aplicación web: layout común, enrutado público/protegido y navegación diferenciada por los cuatro roles (PACIENTE, MÉDICO, ADMIN, SERVICIO AL CLIENTE).

## ADDED Requirements

### Requirement: Acceso a rutas públicas

El sistema SHALL permitir acceder sin sesión a las rutas públicas: inicio de sesión, registro de paciente, solicitud y restablecimiento de contraseña.

#### Scenario: Visitante abre una ruta pública
- **WHEN** un visitante navega a una ruta pública
- **THEN** la vista se muestra completa sin pedir autenticación

#### Scenario: Usuario con sesión activa abre el inicio de sesión
- **WHEN** un usuario autenticado navega al inicio de sesión
- **THEN** es redirigido a su página de inicio según su rol

### Requirement: Protección de rutas privadas

El sistema SHALL requerir sesión activa para toda ruta privada.

#### Scenario: Visitante intenta ruta privada
- **WHEN** un visitante navega a una ruta privada
- **THEN** es redirigido al inicio de sesión conservando la URL solicitada para volver tras autenticarse

#### Scenario: Sesión no recuperable en ruta privada
- **WHEN** la sesión expiró y no puede renovarse mientras se navega una ruta privada
- **THEN** el usuario es enviado al inicio de sesión

### Requirement: Navegación según rol

El sistema SHALL mostrar opciones de navegación distintas para cada rol.

#### Scenario: Navegación del paciente
- **WHEN** inicia sesión un usuario con rol PACIENTE
- **THEN** la navegación ofrece inicio, agendar cita, mis citas y mi perfil

#### Scenario: Navegación del médico
- **WHEN** inicia sesión un usuario con rol MÉDICO
- **THEN** la navegación ofrece agenda del día, mis citas y mi perfil

#### Scenario: Navegación del administrador
- **WHEN** inicia sesión un usuario con rol ADMIN
- **THEN** la navegación ofrece panel de administración (usuarios, personal, especialidades, horarios, citas) y mi perfil

#### Scenario: Navegación de servicio al cliente
- **WHEN** inicia sesión un usuario con rol SERVICIO AL CLIENTE
- **THEN** la navegación ofrece gestión de citas y mi perfil

### Requirement: Bloqueo por rol insuficiente

El sistema SHALL impedir que un rol acceda a vistas reservadas a otros roles.

#### Scenario: Paciente intenta URL administrativa
- **WHEN** un PACIENTE navega directamente a una URL de administración
- **THEN** se muestra una página de acceso denegado sin exponer datos administrativos

#### Scenario: Usuario con varios roles
- **WHEN** un usuario tiene asignados varios roles activos
- **THEN** la navegación combina las opciones permitidas de todos sus roles
