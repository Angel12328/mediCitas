# auth/role-based-access Specification

## Purpose


Implementa control de acceso basado en roles (RBAC) para aplicar permisos en todas las capacidades del sistema basándose en roles de usuario (admin, doctor, paciente, empleado).

## Requirements

### Requirement: Asignación de roles
El sistema SHALL asignar roles a usuarios y mantener estado del rol (activo/inactivo).

#### Scenario: Asignar rol a usuario
- **WHEN** admin asigna rol a usuario
- **THEN** el sistema crea asociación usuario-rol con estado activo

#### Scenario: Desactivar rol de usuario
- **WHEN** admin desactiva rol de usuario
- **THEN** el sistema marca asociación usuario-rol como inactiva

### Requirement: Aplicación de permisos
El sistema SHALL aplicar permisos en todos los endpoints API basándose en roles de usuario.

#### Scenario: Acceso admin
- **WHEN** usuario con rol admin accede a cualquier endpoint
- **THEN** el sistema permite acceso

#### Scenario: Doctor accede a sus propios datos
- **WHEN** doctor accede a su propio horario/pacientes
- **THEN** el sistema permite acceso

#### Scenario: Doctor denegado a datos de otro doctor
- **WHEN** doctor intenta acceder a horario de otro doctor
- **THEN** el sistema deniega acceso con 403

#### Scenario: Paciente accede a sus propias citas
- **WHEN** paciente accede a sus propias citas
- **THEN** el sistema permite acceso

#### Scenario: Acceso no autorizado denegado
- **WHEN** usuario sin rol requerido accede a endpoint protegido
- **THEN** el sistema devuelve 403 Forbidden

### Requirement: Catálogo de roles
El sistema SHALL mantener catálogo de roles disponibles con descripciones.

#### Scenario: Listar roles
- **WHEN** admin solicita lista de roles
- **THEN** el sistema devuelve todos los roles con nombre y estado