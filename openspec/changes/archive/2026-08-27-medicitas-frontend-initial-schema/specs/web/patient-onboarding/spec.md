# web/patient-onboarding (delta)

## Purpose

Autoregistro público de cuentas de paciente: creación de persona, usuario con rol PACIENTE, teléfono opcional y selección de ubicación país → departamento → municipio.

## ADDED Requirements

### Requirement: Formulario de autoregistro de paciente

El sistema SHALL ofrecer un formulario público de registro que capture datos personales (nombres, apellidos, fecha de nacimiento, DNI, género, dirección), ubicación y credenciales de acceso (correo, contraseña), además de teléfono opcional.

#### Scenario: Registro exitoso
- **WHEN** el visitante envía todos los datos obligatorios válidos
- **THEN** se crea su cuenta con rol PACIENTE activo y se le lleva al inicio de sesión con mensaje de éxito

#### Scenario: Correo ya registrado
- **WHEN** el visitante usa un correo que ya pertenece a otro usuario
- **THEN** se muestra un error específico en el campo correo y la cuenta no se crea

#### Scenario: DNI duplicado
- **WHEN** el visitante usa un DNI ya registrado en otra persona
- **THEN** se muestra un error específico en el campo DNI y la cuenta no se crea

#### Scenario: Campos obligatorios incompletos
- **WHEN** el visitante omite campos obligatorios o usa formatos inválidos
- **THEN** se muestran errores por campo y no se envía el registro

### Requirement: Selección de ubicación dependiente

El formulario SHALL cargar departamentos según el país seleccionado y municipios según el departamento seleccionado.

#### Scenario: País seleccionado
- **WHEN** el visitante selecciona un país
- **THEN** el selector de departamentos se llena con los departamentos de ese país

#### Scenario: Departamento seleccionado
- **WHEN** el visitante selecciona un departamento
- **THEN** el selector de municipios se llena solo con los municipios de ese departamento

### Requirement: Datos clínicos pos-registro

El autoregistro SHALL NO exigir los datos clínicos del paciente (tipo de sangre, alergias, contacto de emergencia); estos se completan después desde el perfil.

#### Scenario: Registro sin datos clínicos
- **WHEN** el visitante completa el registro sin ingresar datos clínicos
- **THEN** la cuenta de paciente se crea correctamente y puede añadirlos más tarde en su perfil
