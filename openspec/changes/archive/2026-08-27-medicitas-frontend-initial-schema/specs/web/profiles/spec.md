## Purpose

Consulta y edición del perfil del usuario autenticado: datos personales, ubicación, teléfonos y, para pacientes, sus datos clínicos.

## ADDED Requirements

### Requirement: Visualización del perfil propio

El sistema SHALL mostrar al usuario autenticado sus datos personales (nombres, apellidos, DNI, género, fecha de nacimiento), dirección con ubicación país → departamento → municipio, correos y teléfonos registrados.

#### Scenario: Paciente abre su perfil
- **WHEN** un PACIENTE accede a su perfil
- **THEN** ve sus datos personales, ubicación, teléfonos y su sección de datos clínicos

#### Scenario: Empleado abre su perfil
- **WHEN** un MÉDICO, ADMIN o SERVICIO AL CLIENTE accede a su perfil
- **THEN** ve sus datos personales, ubicación y teléfonos sin sección de datos clínicos

### Requirement: Edición de datos personales

El sistema SHALL permitir editar los campos modificables del perfil validando formatos antes de enviar.

#### Scenario: Cambio guardado correctamente
- **WHEN** el usuario modifica campos permitidos con valores válidos y guarda
- **THEN** los cambios persisten y se reflejan en la vista

#### Scenario: Valor inválido en edición
- **WHEN** el usuario envía el formulario con un valor inválido
- **THEN** se muestran errores por campo y no se envía la actualización

#### Scenario: Campos de identidad no editables
- **WHEN** el usuario consulta su perfil
- **THEN** DNI y fecha de nacimiento se muestran como solo lectura

### Requirement: Gestión de teléfonos propios

El sistema SHALL permitir al usuario agregar y quitar sus teléfonos indicando número y extensión.

#### Scenario: Agregar teléfono
- **WHEN** el usuario registra un nuevo teléfono con extensión válida
- **THEN** aparece en su lista de contactos

#### Scenario: Quitar teléfono
- **WHEN** el usuario elimina uno de sus teléfonos
- **THEN** deja de aparecer en su lista

### Requirement: Datos clínicos del paciente

El sistema SHALL permitir al PACIENTE mantener su tipo de sangre, alergias y contacto de emergencia.

#### Scenario: Paciente completa sus datos clínicos
- **WHEN** el PACIENTE guarda tipo de sangre, alergias y contacto de emergencia válidos
- **THEN** quedan asociados a su perfil de paciente y visibles en futuras sesiones

#### Scenario: Tipo de sangre inválido
- **WHEN** el PACIENTE intenta guardar un tipo de sangre fuera del catálogo válido
- **THEN** se muestra un error en el campo y no se guarda
