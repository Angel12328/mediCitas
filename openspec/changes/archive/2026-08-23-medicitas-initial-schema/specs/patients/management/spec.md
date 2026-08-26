## Purpose

Gestiona registros de pacientes incluyendo información personal, detalles médicos (tipo de sangre, alergias) y contactos de emergencia.

## ADDED Requirements

### Requirement: Registro de paciente
El sistema DEBE crear registros de pacientes vinculados a cuentas de usuario con información médica.

#### Scenario: Crear perfil de paciente
- **WHEN** usuario con rol paciente completa registro
- **THEN** sistema crea registro de paciente con tipo de sangre y contactos de emergencia/alergias opcionales

#### Scenario: Validar tipo de sangre
- **WHEN** paciente proporciona tipo de sangre
- **THEN** sistema valida contra tipos de sangre estándar (A+, A-, B+, B-, AB+, AB-, O+, O-)

### Requirement: Gestión de perfil de paciente
El sistema DEBE permitir a pacientes ver y actualizar su información médica.

#### Scenario: Ver propio perfil de paciente
- **WHEN** paciente autenticado solicita su perfil
- **THEN** sistema devuelve registro completo de paciente incluyendo info médica

#### Scenario: Actualizar información médica
- **WHEN** paciente actualiza tipo de sangre, alergias o contactos de emergencia
- **THEN** sistema persiste cambios y devuelve registro actualizado

### Requirement: Gestión de contactos de emergencia
El sistema DEBE almacenar y recuperar nombre y número de teléfono de contacto de emergencia.

#### Scenario: Agregar contacto de emergencia
- **WHEN** paciente agrega nombre y teléfono de contacto de emergencia
- **THEN** sistema almacena info de contacto vinculada a paciente

#### Scenario: Actualizar contacto de emergencia
- **WHEN** paciente modifica detalles de contacto de emergencia
- **THEN** sistema actualiza la información almacenada