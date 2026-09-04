# Propuesta: Esquema inicial del frontend mediCitas

## Why

El proyecto cuenta con una API Fastify madura (`/api/v1/*`) que cubre todos los dominios del modelo relacional (`modelo_relacional.mwb`: 18 tablas), pero no existe ninguna aplicación frontend: los flujos de negocio solo son accesibles vía Swagger. Se necesita el esqueleto inicial de la aplicación web que consuma esa API y haga operativa la gestión de citas médicas para pacientes y personal.

## What Changes

- Creación de una nueva aplicación frontend **Next.js** (App Router) en TypeScript dentro del mismo repositorio (carpeta `web/`), consumiendo la API REST existente.
- Stack confirmado por el usuario:
  - **Next.js 15 + React 19 + TypeScript**: App Router con Server Components para lectura de catálogos y Client Components para interacción.
  - **TanStack Query**: estado del servidor interactivo (cacheo, invalidación, reintentos) contra la API REST.
  - **react-hook-form + zod**: formularios validados; esquemas espejo de los de la API.
  - **Tailwind CSS v4 + shadcn/ui**: UI limpia y accesible adecuada para un producto de salud.
  - **Cliente API tipado generado desde el OpenAPI** expuesto en `/docs` (openapi-typescript), evitando duplicación manual de tipos.
  - **Sesión JWT**: tokens access/refresh gestionados vía cookies httpOnly establecidas por Route Handlers de Next.js.
  - **Vitest + Testing Library**: misma herramienta de pruebas que el backend.
- Alcance confirmado: **los cuatro roles** (PACIENTE, MÉDICO, ADMIN, SERVICIO AL CLIENTE) con vistas diferenciadas desde la primera versión.
- Registro de pacientes **dual**: autoregistro público más alta manual por ADMIN.
- Agendamiento por flujo **Especialidad → Doctor → Horario**.
- **Calidad asistida por skills**: cada tarea se verifica con las skills QA de `petrkindlmann/qa-skills` (Agent Skills Standard).
- **Diseño de UI asistido por skills**: la capa visual (tokens, componentes, motion, estados) se construye con las skills de diseño de `ibelick/ui-skills` sobre Tailwind + shadcn/ui.
- **SEO técnico en rutas públicas**: metadatos, Open Graph, robots/sitemap y datos estructurados implementados con las skills de `coreyhaines31/marketingskills` (seo-audit, ai-seo, site-architecture, schema).
- **Test de seguridad integral** al cierre, usando las skills de `mukul975/Anthropic-Cybersecurity-Skills` sobre toda la aplicación (web + API).
- **Publicación** del código completo en `https://github.com/Angel12328/mediCitas.git` una vez aprobados los tests de seguridad.
- **Despliegue continuo en Vercel**: el repositorio queda conectado a Vercel para que cada push a GitHub refleje los cambios automáticamente (producción desde `main`, previews por rama/PR).
- Módulos derivados del modelo relacional:
  1. **Identidad y acceso** (Usuario, Persona, Rol, UsuarioRol): login, sesión con tokens access/refresh, recuperación de contraseña, navegación según rol.
  2. **Perfil** (Persona, Telefono, Extension, País/Departamento/Municipio): datos personales, ubicación jerárquica y teléfonos.
  3. **Pacientes** (Paciente): datos clínicos (tipo de sangre, alergias, contacto de emergencia), autoregistro y alta manual.
  4. **Personal** (Empleado, Cargo, EmpleadoCargo, Doctor, Especialidad, DoctorEspecialidad): consola de administración de personal médico.
  5. **Horarios** (HorarioAtencion): administración de días, franjas horarias y cupos por doctor/especialidad.
  6. **Citas** (Cita): agendamiento por parte del paciente y gestión de estados (PA/APUN/ATEN/NA) por parte del personal.

## Capabilities

### New Capabilities

- `web/shell`: esqueleto de la aplicación — layout, enrutado público/protegido, navegación y redirecciones según rol con vistas diferenciadas para PACIENTE, MÉDICO, ADMIN y SERVICIO AL CLIENTE.
- `web/auth`: pantallas y flujo de autenticación — inicio de sesión, cierre de sesión, renovación de sesión, recuperación y restablecimiento de contraseña.
- `web/patient-onboarding`: autoregistro público de paciente — persona + usuario + rol PACIENTE + teléfono, con selección país → departamento → municipio.
- `web/profiles`: perfil del usuario autenticado — edición de datos personales, ubicación y teléfonos; datos clínicos adicionales para pacientes.
- `web/catalogs`: consulta de catálogos compartidos para formularios — países/departamentos/municipios, especialidades, extensiones y cargos.
- `web/staff-admin`: consola administrativa (ADMIN) — gestión de usuarios y roles con alta manual de cuentas, empleados y sus cargos, doctores y asignación de especialidades.
- `web/schedules`: administración de horarios de atención — CRUD de franjas por doctor/especialidad con días, hora inicio/fin y cupos.
- `web/appointments`: flujo de citas por rol — agendamiento del paciente vía Especialidad → Doctor → Horario; MÉDICO consulta su agenda y marca ATEN/NA; ADMIN/SERVC gestionan citas en estado PA/APUN.

### Modified Capabilities

_(ninguna — el backend no cambia; el frontend consume la API existente)_

## Impact

- **Nuevo código**: directorio `web/` (aplicación Next.js completa); no se modifica código del backend.
- **Dependencias nuevas**: next, react, react-dom, @tanstack/react-query, react-hook-form, zod, tailwindcss, shadcn/ui, openapi-typescript (dev), vitest + testing-library (dev).
- **Integraciones**: consume endpoints `/api/v1/*` existentes (auth, users, locations, employees, cargos, specialties, doctors, schedules, patients, phones, extensions, appointments) y el spec OpenAPI de `/docs/json`.
- **Configuración**: rewrites/proxy de desarrollo hacia `http://localhost:3000`; variable `API_URL` de servidor; cookies httpOnly para sesión; CORS ya habilitado vía `@fastify/cors`.
- **Herramientas de QA, diseño y seguridad**: skills instaladas vía `npx skills add` desde `petrkindlmann/qa-skills`, `ibelick/ui-skills` y `mukul975/Anthropic-Cybersecurity-Skills`; contexto QA en `.agents/qa-project-context.md` y contexto de producto en `.agents/product-marketing.md`.
- **Repositorio remoto**: inicialización de git y push a `https://github.com/Angel12328/mediCitas.git` al cierre (sin secretos; `.env` excluido).
- **Hosting**: web en Vercel (Root Directory `web/`, despliegue automático por push, variables `API_URL` en dashboard) y API en Render free vía Blueprint `render.yaml`; base de datos Postgres en Supabase free (sin caducidad de datos; el proyecto se pausa tras ~7 días de inactividad y se reactiva desde el dashboard). Se acepta cold start de ~30-60 s tras inactividad del API.

## Decisiones confirmadas con el usuario

1. Los cuatro roles tienen interfaz propia desde la primera versión.
2. Agendamiento del paciente: Especialidad → Doctor → Horario disponible.
3. Registro de pacientes: autoregistro público y alta manual por ADMIN.
