# Notas de implementación

**Pruebas obligatorias:** Cada tarea será sometida a pruebas automatizadas (unitarias, de integración y/o E2E) antes de considerarse completada. No se marcará una tarea como hecha hasta que sus tests pasen.

**Skills de QA:** Se utilizará el repositorio de skills de calidad https://github.com/petrkindlmann/qa-skills como referencia para definir estrategias de testing, patrones de pruebas y mejores prácticas de QA. Este repositorio se clonará/referenciará en la raíz del proyecto.

**Ubicación del repositorio:** El repositorio del proyecto mediCitas se mantendrá en la raíz del proyecto (`/home/angel/Documentos/portafolioDev/mediCitas-proyect/`). Todos los artefactos, código fuente, configuración y documentación residirán allí.

---

## 1. Configuración del proyecto

- [x] 1.1 Inicializar proyecto Node.js/TypeScript con Fastify, verificar que `npm init` crea package.json
- [x] 1.2 Instalar dependencias core: fastify, @fastify/swagger, @fastify/cors, @fastify/helmet, zod, prisma, @prisma/client, @node-rs/argon2, jsonwebtoken, uuid, verificar que `npm install` funciona
- [x] 1.3 Instalar dependencias de desarrollo: typescript, tsx, vitest, @types/node, eslint, prettier, verificar que `npm install -D` funciona
- [x] 1.4 Configurar TypeScript (tsconfig.json) con modo estricto, verificar que `npx tsc --noEmit` pasa
- [x] 1.5 Configurar ESLint + Prettier, verificar que `npm run lint` pasa
- [x] 1.6 Configurar estructura del proyecto (src/modules, src/shared), verificar que existe estructura de carpetas
- [x] 1.7 Crear Dockerfile y docker-compose.yml para PostgreSQL, verificar que `docker compose up -d` inicia la base de datos
- [x] 1.8 Configurar Prisma con proveedor PostgreSQL, verificar que `npx prisma validate` pasa

## 2. Esquema de base de datos y migraciones

- [x] 2.1 Convertir modelo MySQL Workbench a esquema Prisma (schema.prisma), verificar que todas las 18 tablas están mapeadas con tipos/relaciones correctas
- [x] 2.2 Definir enums PostgreSQL para: user_status, role_status, specialty_status, doctor_status, employee_status, cargo_status, schedule_status, appointment_status, blood_type, verificar que definiciones de enums coinciden con spec
- [x] 2.3 Agregar claves primarias UUID, created_at/updated_at, deleted_at (soft delete) a todos los modelos, verificar que esquema compila
- [x] 2.4 Crear migración inicial, verificar que `npx prisma migrate dev --name init` funciona
- [x] 2.5 Seed de datos de referencia: países, departamentos, municipios, roles, especialidades, cargos, extensiones, verificar que script seed ejecuta y datos persisten
- [x] 2.6 Configurar Prisma Studio para acceso admin, verificar que `npx prisma studio` abre

## 3. Infraestructura compartida

- [x] 3.1 Implementar cliente singleton de base de datos (PrismaClient), verificar que conexión funciona en test
- [x] 3.2 Crear utilidades de manejo de errores (AppError, códigos de error), verificar que formato de errores coincide con RFC 7807
- [x] 3.3 Implementar middleware de validación Zod, verificar que validación de request funciona en endpoint de prueba
- [x] 3.4 Crear helpers de paginación (cursor/offset), verificar que tests de paginación pasan
- [x] 3.5 Implementar logging estructurado (pino), verificar que logs salen en formato JSON
- [x] 3.6 Crear módulo de configuración (variables de entorno con Zod), verificar que config carga correctamente

## 4. Módulo de Autenticación (auth/user-management, auth/role-based-access)

- [x] 4.1 Implementar hash de contraseñas con Argon2id, verificar que hash/verify roundtrip funciona
- [x] 4.2 Crear servicio JWT (sign, verify, decode), verificar generación/validación de tokens
- [x] 4.3 Implementar rotación de refresh tokens con detección de reuso, verificar que rotación funciona y tokens reusados son revocados
- [x] 4.4 Construir endpoint de registro de usuario (POST /api/v1/auth/register), verificar que crea usuario + persona + enlace paciente/empleado
- [x] 4.5 Construir endpoint de login (POST /api/v1/auth/login), verificar que devuelve access + refresh tokens
- [x] 4.6 Construir endpoint de refresh token (POST /api/v1/auth/refresh), verificar que rota tokens
- [x] 4.7 Construir endpoint de logout (POST /api/v1/auth/logout), verificar que revoca refresh token
- [x] 4.8 Construir endpoint de cambio de contraseña (POST /api/v1/auth/change-password), verificar que actualiza hash y revoca sesiones
- [x] 4.9 Construir endpoint de solicitud de restablecimiento (POST /api/v1/auth/forgot-password), verificar que envía email de restablecimiento (mock)
- [x] 4.10 Construir endpoint de confirmación de restablecimiento (POST /api/v1/auth/reset-password), verificar que actualiza contraseña
- [x] 4.11 Implementar middleware RBAC (role guard), verificar que bloquea roles no autorizados
- [x] 4.12 Implementar guard de propiedad de recursos (datos propios doctor/paciente), verificar que chequeos de propiedad funcionan
- [x] 4.13 Crear endpoints de perfil de usuario (GET/PATCH /api/v1/users/me), verificar que devuelve/actualiza perfil
- [x] 4.14 Escribir tests de integración para flujo de auth, verificar que todos los tests de auth pasan

## 5. Módulo de Ubicaciones (locations/hierarchy)

- [x] 5.1 Crear endpoints CRUD de Country (GET/POST /api/v1/countries), verificar que CRUD funciona
- [x] 5.2 Crear endpoints CRUD de Department (GET/POST /api/v1/departments), verificar que filtro por país funciona
- [x] 5.3 Crear endpoints CRUD de Municipality (GET/POST /api/v1/municipalities), verificar que filtro por departamento funciona
- [x] 5.4 Agregar endpoint de jerarquía (GET /api/v1/locations/tree), verificar que devuelve árbol completo
- [x] 5.5 Escribir tests para módulo de ubicaciones, verificar que todos los tests pasan

## 6. Módulo de Usuarios y Roles (auth/user-management, auth/role-based-access)

- [x] 6.1 Crear endpoints CRUD de Role (GET/POST/PATCH /api/v1/roles), verificar que gestión de roles funciona
- [x] 6.2 Crear endpoints de asignación usuario-rol (POST/DELETE /api/v1/users/:id/roles), verificar que asignación funciona
- [x] 6.3 Crear listado de usuarios con filtros (GET /api/v1/users), verificar que paginación y filtros funcionan
- [x] 6.4 Escribir tests para módulo usuarios/roles, verificar que todos los tests pasan

## 7. Módulo de Empleados y Cargos (employees/management, employees/cargo)

- [x] 7.1 Crear endpoints CRUD de Cargo (GET/POST/PATCH /api/v1/cargos), verificar que gestión de cargos funciona
- [x] 7.2 Crear endpoints CRUD de Employee (GET/POST/PATCH /api/v1/employees), verificar que vinculación a usuario funciona
- [x] 7.3 Crear endpoints de asignación Empleado-Cargo (POST /api/v1/employees/:id/cargos), verificar que historial se preserva
- [x] 7.4 Escribir tests para módulo empleados/cargos, verificar que todos los tests pasan

## 8. Módulo de Doctores (doctors/management, doctors/specialties, doctors/schedules)

- [x] 8.1 Crear endpoints CRUD de Specialty (GET/POST/PATCH /api/v1/specialties), verificar que gestión de especialidades funciona
- [x] 8.2 Crear endpoints CRUD de Doctor (GET/POST/PATCH /api/v1/doctors), verificar que vinculación a empleado funciona
- [x] 8.3 Crear endpoints de asignación Doctor-Especialidad (POST/DELETE /api/v1/doctors/:id/specialties), verificar que asignaciones funcionan
- [x] 8.4 Crear endpoints CRUD de Schedule (GET/POST/PATCH/DELETE /api/v1/schedules), verificar que horario con bitmask de días funciona
- [x] 8.5 Implementar endpoint de consulta de disponibilidad (GET /api/v1/schedules/availability), verificar que devuelve cupos con capacidad
- [x] 8.6 Escribir tests para módulo doctores, verificar que todos los tests pasan

## 9. Módulo de Pacientes (patients/management)

- [x] 9.1 Crear endpoints CRUD de Patient (GET/PATCH /api/v1/patients/me), verificar que gestión de perfil de paciente funciona
- [x] 9.2 Crear endpoints de contactos de emergencia (GET/POST/PATCH /api/v1/patients/me/emergency-contact), verificar que CRUD de contactos funciona
- [x] 9.3 Escribir tests para módulo pacientes, verificar que todos los tests pasan

## 10. Módulo de Contactos (contacts/phone-management)

- [x] 10.1 Crear endpoints CRUD de Extension (GET/POST/PATCH /api/v1/extensions), verificar que gestión de extensiones funciona
- [x] 10.2 Crear endpoints CRUD de Phone (GET/POST/PATCH/DELETE /api/v1/phones), verificar que vinculación a persona funciona
- [x] 10.3 Escribir tests para módulo contactos, verificar que todos los tests pasan

## 11. Módulo de Citas (appointments/management)

- [x] 11.1 Crear endpoint de reserva de cita (POST /api/v1/appointments), verificar reserva con bloqueo optimista
- [x] 11.2 Crear endpoints de actualización de estado de cita (PATCH /api/v1/appointments/:id/status), verificar transiciones de estado
- [x] 11.3 Crear endpoints de listado de citas (GET /api/v1/appointments), verificar que filtrado por rol funciona
- [x] 11.4 Crear endpoints de observaciones de cita (POST /api/v1/appointments/:id/observations), verificar que observaciones funcionan
- [x] 11.5 Implementar lógica de posición en cola, verificar que posiciones se asignan correctamente
- [x] 11.6 Escribir tests para módulo citas, verificar que todos los tests pasan

## 12. Documentación API e Integración

- [x] 12.1 Generar documentación OpenAPI/Swagger desde esquemas de rutas, verificar que endpoint `/docs` sirve UI
- [x] 12.2 Escribir tests de integración end-to-end cubriendo flujos completos de usuario, verificar que tests E2E pasan
- [x] 12.3 Ejecutar suite completa de tests, verificar que todos los tests pasan
- [x] 12.4 Construir imagen Docker de producción, verificar que `docker build` funciona
- [x] 12.5 Verificar despliegue con docker-compose, verificar que todos los servicios inician y health checks pasan