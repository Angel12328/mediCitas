## Por qué

Este proyecto necesita una propuesta técnica inicial para construir un sistema de gestión de citas médicas (mediCitas) basado en el modelo relacional existente definido en MySQL Workbench. El modelo contiene 18 tablas que cubren usuarios, pacientes, doctores, citas, especialidades, horarios, ubicaciones y roles. Se necesita una propuesta estructurada para definir alcance, capacidades y elecciones tecnológicas antes de comenzar la implementación.

## Qué cambia

- Crear una API backend completa para gestión de citas médicas
- Implementar autenticación y autorización de usuarios con control de acceso basado en roles
- Construir gestión de pacientes (registro, historial médico, contactos de emergencia)
- Construir gestión de doctores (especialidades, horarios, disponibilidad)
- Implementar programación de citas con franjas horarias y gestión de capacidad
- Crear jerarquía de ubicaciones (país, departamento, municipio)
- Diseñar esquema de base de datos que coincida con el modelo de MySQL Workbench existente
- Configurar estructura del proyecto con tecnologías recomendadas

## Capacidades

### Nuevas capacidades

- `auth/user-management`: Registro de usuarios, login, gestión de contraseñas, manejo de sesiones
- `auth/role-based-access`: Asignación de roles (admin, doctor, paciente, empleado), aplicación de permisos
- `patients/management`: CRUD de pacientes, tipo de sangre, alergias, contactos de emergencia
- `doctors/management`: Perfiles de doctores, especialidades, vinculación laboral
- `doctors/specialties`: Catálogo de especialidades médicas con seguimiento de estado
- `doctors/schedules`: Horarios de disponibilidad de doctores por especialidad con franjas horarias y capacidad
- `appointments/management`: Reserva de citas, seguimiento de estado, posición en cola
- `locations/hierarchy`: Jerarquía de ubicaciones País → Departamento → Municipio
- `employees/management`: Registros de empleados vinculados a usuarios y roles
- `employees/cargo`: Gestión de puestos/cargos para empleados
- `contacts/phone-management`: Números de teléfono con extensiones para personas

### Capacidades modificadas

Ninguna - esta es una aplicación nueva sin capacidades existentes para modificar.

## Impacto

- **Nuevo proyecto**: Aplicación greenfield - sin código existente que migrar
- **Base de datos**: Esquema MySQL/PostgreSQL con 18 tablas, claves foráneas, índices
- **API**: Endpoints RESTful para todas las capacidades
- **Autenticación**: Auth basada en JWT con permisos basados en roles
- **Frontend**: Se necesitará una aplicación frontend separada (React/Vue/Angular)
- **Despliegue**: Contenedorización con Docker recomendada