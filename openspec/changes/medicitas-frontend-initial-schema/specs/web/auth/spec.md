## Purpose

Autenticación de usuarios contra la API mediCitas: inicio y cierre de sesión, renovación transparente de la sesión y recuperación de contraseña.

## ADDED Requirements

### Requirement: Inicio de sesión

El sistema SHALL permitir iniciar sesión con correo y contraseña.

#### Scenario: Credenciales válidas
- **WHEN** el usuario envía credenciales correctas
- **THEN** la sesión queda establecida y es redirigido a su página de inicio según su rol

#### Scenario: Credenciales inválidas
- **WHEN** el usuario envía credenciales incorrectas
- **THEN** se muestra un mensaje genérico de error sin indicar cuál campo falló

#### Scenario: Campos obligatorios vacíos
- **WHEN** el usuario envía el formulario sin correo o sin contraseña
- **THEN** se muestran errores por campo y no se envía ninguna petición de acceso

### Requirement: Cierre de sesión

El sistema SHALL permitir cerrar la sesión desde cualquier vista autenticada.

#### Scenario: Cierre exitoso
- **WHEN** el usuario cierra sesión
- **THEN** los tokens de sesión se eliminan y es redirigido al inicio de sesión

### Requirement: Renovación transparente de sesión

El sistema SHALL renovar la sesión automáticamente usando el token de refresco cuando el token de acceso expire durante el uso normal.

#### Scenario: Token de acceso expirado en pleno uso
- **WHEN** una petición falla porque el token de acceso expiró
- **THEN** la sesión se renueva y la petición original se repite sin interrumpir al usuario

#### Scenario: Refresh token también expirado
- **WHEN** la renovación falla porque la sesión ya no puede recuperarse
- **THEN** el usuario es enviado al inicio de sesión con aviso de que debe volver a autenticarse

### Requirement: Recuperación de contraseña

El sistema SHALL permitir solicitar el restablecimiento de contraseña por correo y completarlo con el token recibido.

#### Scenario: Solicitud con correo registrado
- **WHEN** el usuario solicita recuperación para un correo registrado
- **THEN** se confirma el envío de instrucciones al correo

#### Scenario: Solicitud con correo inexistente
- **WHEN** el usuario solicita recuperación para un correo no registrado
- **THEN** se muestra la misma confirmación neutra, sin revelar si el correo existe

#### Scenario: Restablecimiento con token válido
- **WHEN** el usuario define una nueva contraseña mediante un token vigente
- **THEN** la contraseña se actualiza y puede iniciar sesión con ella

#### Scenario: Token inválido o expirado
- **WHEN** el usuario intenta restablecer con un token inválido o expirado
- **THEN** se informa el error y se le ofrece solicitar uno nuevo
