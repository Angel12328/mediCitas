# auth/user-management Specification

## Purpose


Gestiona cuentas de usuario incluyendo registro, autenticación, gestión de perfil y manejo de sesiones para todos los usuarios del sistema (pacientes, doctores, empleados, administradores).

## Requirements

### Requirement: Registro de usuario
El sistema SHALL permitir que nuevos usuarios se registren con correo electrónico, contraseña e información personal vinculada.

#### Scenario: Registro exitoso
- **WHEN** un nuevo usuario proporciona correo, contraseña y detalles personales válidos
- **THEN** el sistema crea la cuenta de usuario con contraseña hasheada y devuelve éxito

#### Scenario: Rechazo de correo duplicado
- **WHEN** un usuario intenta registrarse con un correo ya registrado
- **THEN** el sistema rechaza el registro con mensaje de error apropiado

### Requirement: Autenticación de usuario
El sistema SHALL autenticar usuarios mediante correo electrónico y contraseña, devolviendo un token de sesión seguro.

#### Scenario: Login exitoso
- **WHEN** el usuario proporciona correo y contraseña válidos
- **THEN** el sistema devuelve token de acceso JWT con ID de usuario y roles

#### Scenario: Login fallido
- **WHEN** el usuario proporciona credenciales inválidas
- **THEN** el sistema rechaza con error genérico (sin enumeración de usuarios)

### Requirement: Gestión de contraseñas
El sistema SHALL permitir a los usuarios cambiar su contraseña y solicitar restablecimiento.

#### Scenario: Cambio de contraseña
- **WHEN** usuario autenticado proporciona contraseña actual y nueva
- **THEN** el sistema actualiza el hash de contraseña e invalida sesiones existentes

#### Scenario: Solicitud de restablecimiento de contraseña
- **WHEN** usuario solicita restablecimiento para correo registrado
- **THEN** el sistema envía enlace de restablecimiento (detalle de implementación: servicio de email)

### Requirement: Gestión de perfil de usuario
El sistema SHALL permitir a los usuarios ver y actualizar su información de perfil.

#### Scenario: Ver perfil
- **WHEN** usuario autenticado solicita su perfil
- **THEN** el sistema devuelve datos del usuario incluyendo información de persona vinculada

#### Scenario: Actualizar perfil
- **WHEN** usuario autenticado actualiza campos permitidos
- **THEN** el sistema persiste cambios y devuelve perfil actualizado