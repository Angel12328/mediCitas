## Contexto

Este es un proyecto greenfield para un sistema de gestión de citas médicas (mediCitas). El modelo relacional está definido en MySQL Workbench (modelo_relacional.mwb) con 18 tablas que cubren usuarios, pacientes, doctores, citas, especialidades, horarios, ubicaciones, roles, empleados y contactos. No existe base de código existente - será una implementación nueva.

## Objetivos / No objetivos

**Objetivos:**
- Diseñar arquitectura de API backend escalable que coincida con el modelo relacional de 18 tablas
- Definir pila tecnológica para backend Node.js/TypeScript con PostgreSQL
- Diseñar autenticación/autorización con JWT y RBAC
- Planear estrategia de migración de base de datos desde modelo MySQL Workbench
- Definir estructura de API (endpoints RESTful) para las 11 capacidades
- Planear arquitectura de despliegue con Docker

**No objetivos:**
- Implementación frontend (proyecto separado)
- Desarrollo de app móvil
- Servicios de notificación email/SMS (abstractos detrás de interfaces)
- Reportes/analíticas avanzadas (fase futura)
- Multi-tenancy (despliegue de clínica única)

## Decisiones

### Pila tecnológica

**Backend:** Node.js con TypeScript usando Fastify
- **Justificación:** Rendimiento rápido, soporte nativo TypeScript, ecosistema de plugins, menor overhead que Express
- **Alternativas consideradas:** Express (más maduro pero más lento), NestJS (más pesado, más opinado), Go/Rust (curva de aprendizaje más pronunciada para el equipo)

**Base de datos:** PostgreSQL
- **Justificación:** Mejor soporte JSON, indexación avanzada, integridad de datos más estricta que MySQL, excelente soporte ORM TypeScript
- **Migración:** Convertir modelo MySQL Workbench a DDL PostgreSQL (InnoDB → equivalente InnoDB, AUTO_INCREMENT → SERIAL/IDENTITY)
- **Alternativas consideradas:** MySQL (modelo original), MongoDB (no apto para modelo relacional)

**ORM:** Prisma
- **Justificación:** Acceso a BD type-safe, excelente sistema de migraciones, Prisma Studio para admin, buen soporte PostgreSQL
- **Alternativas consideradas:** TypeORM (más complejo), Drizzle (más nuevo, menos maduro), SQL crudo (muy verboso)

**Autenticación:** JWT con rotación de refresh tokens
- **Justificación:** Stateless, escalable, estándar de la industria
- **Estrategia de tokens:** Access tokens de vida corta (15min), refresh tokens de vida larga (7 días) con rotación y detección de reuso
- **Hash de contraseñas:** Argon2id vía @node-rs/argon2

**Autorización:** Control de Acceso Basado en Roles (RBAC) con permisos a nivel de recurso
- **Roles:** admin, doctor, paciente, empleado (de tabla Rol)
- **Modelo de permisos:** Mapeo Rol → Permisos, aplicado a nivel de ruta vía hooks de Fastify
- **Propiedad de recursos:** Chequeos adicionales para acceso a datos propios de doctor/paciente

**Diseño de API:** RESTful con especificación OpenAPI 3.0
- **Versionado:** Versionado por path URL (/api/v1/)
- **Paginación:** Basada en cursor para listas, limit/offset para casos simples
- **Formato de errores:** RFC 7807 Problem Details
- **Validación:** Esquemas Zod para validación request/response

**Estructura del proyecto:** Monolito modular (carpetas basadas en features)
```
src/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── patients/
│   ├── doctors/
│   ├── appointments/
│   ├── locations/
│   ├── employees/
│   └── contacts/
├── shared/
│   ├── database/
│   ├── auth/
│   ├── validation/
│   └── errors/
└── main.ts
```

### Mapeo de esquema de base de datos

Mapeo directo desde modelo MySQL Workbench a PostgreSQL:

| Tabla MySQL | Tabla PostgreSQL | Cambios clave |
|-------------|------------------|---------------|
| Usuario | users | email UNIQUE, password_hash, rol vía user_roles |
| Persona | persons | Todos los campos, FK a ubicaciones |
| Departamento | departments | |
| Municipio | municipalities | FK a departments |
| Rol | roles | |
| UsuarioRol | user_roles | PK compuesta (user_id, role_id) |
| Especialidad | specialties | |
| Doctor | doctors | FK a employees, enum status |
| Pais | countries | |
| Empleado | employees | FK a users |
| Cargo | cargos | |
| EmpleadoCargo | employee_cargos | PK compuesta, timestamp |
| DoctorEspecialidad | doctor_specialties | PK compuesta, status |
| HorarioAtencion | schedules | FK a doctors, specialties, días como bitmask/array |
| Telefono | phones | FK a persons, extensions |
| Extension | extensions | |
| Paciente | patients | FK a users, enum blood_type, JSON para allergies |
| Cita | appointments | FK a patients, schedules, enum status |

**Decisiones clave de diseño:**
- Usar UUIDs para todas las claves primarias (mejor para sistemas distribuidos) vs enteros auto-incrementales originales
- Tipos enum para campos de estado (estado) y tipos de sangre
- Soft deletes vía timestamp `deleted_at` en todas las tablas
- Campos de auditoría: `created_at`, `updated_at` en todas las tablas
- Claves primarias compuestas para tablas de unión (user_roles, employee_cargos, doctor_specialties)

### Representación de horarios

La tabla `HorarioAtencion` usa `diasAtencion` como entero. Decisión de diseño:
- Almacenar como array `INT[]` de PostgreSQL con números de día (1=Lunes, 7=Domingo)
- O usar bitmask (entero con bits 0-6)
- **Elegido:** Bitmask entero para almacenamiento compacto y consultas rápidas

### Concurrencia en reserva de citas

**Estrategia:** Bloqueo optimista con columna version en horarios
- Cada horario tiene entero `version`
- Reserva verifica capacidad disponible, luego incrementa version
- Reintenta en caso de mismatch de version (máx 3 reintentos)
- Alternativa considerada: Bloqueo pesimista (SELECT FOR UPDATE) - rechazada por contención

## Riesgos / Trade-offs

| Riesgo | Mitigación |
|--------|------------|
| Condiciones de carrera en reserva de horarios | Bloqueo optimista con reintentos, constraint unique a nivel BD en (schedule_id, date, position) |
| Robo de tokens JWT | Access tokens cortos, rotación de refresh tokens, cookies HttpOnly seguras para web |
| Migración de datos desde modelo MySQL | Script automatizado para convertir .mwb → esquema Prisma → PostgreSQL |
| Consultas RBAC complejas | Cache de permisos pre-calculado, índices en BD en user_roles |
| Rendimiento consultas de disponibilidad de horarios | Vista materializada para cupos disponibles, refresco en cambios de horario |
| Manejo de zonas horarias | Almacenar todo en UTC, convertir en display, horarios en hora local con columna timezone |

## Plan de migración

1. **Fase 1:** Convertir modelo MySQL Workbench a esquema Prisma
2. **Fase 2:** Generar y ejecutar migración inicial en PostgreSQL
3. **Fase 3:** Seed de datos de referencia (países, departamentos, municipios, roles, especialidades, cargos, extensiones)
4. **Fase 4:** Implementar módulos en orden de dependencias (auth → users → locations → employees → doctors → patients → schedules → appointments)
5. **Fase 5:** Testing de integración, generación de documentación API

## Preguntas abiertas

- ¿Debería `diasAtencion` de horarios soportar excepciones (festivos, vacaciones de doctor)?
- ¿Se requiere verificación de email para registro de usuarios?
- ¿Deberían las citas soportar reservas recurrentes?
- ¿Qué nivel de auditoría se necesita para cumplimiento de datos médicos?