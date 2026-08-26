# QA Project Context — mediCitas

## Product
- **Nombre:** mediCitas — sistema de gestión de citas médicas (API Fastify + web Next.js para pacientes y personal).
- **Tipo:** Aplicación transaccional de salud (portal autenticado multi-rol + API REST).
- **URLs:** desarrollo local (`http://localhost:3000` API, `http://localhost:3001` web prevista); producción planeada: Vercel (web), Render (API), Supabase (Postgres).
- **Journeys críticos (si fallan, es incidente):**
  1. Paciente inicia sesión y ve su inicio según rol.
  2. Visitante se autorregistra como paciente (persona + ubicación + credenciales).
  3. Paciente agenda cita: especialidad → doctor → horario disponible con cupos → confirmación.
  4. Paciente cancela una cita futura y el cupo se libera.
  5. Médico consulta su agenda del día y marca ATEN/NA.
  6. ADMIN/SERVC listan, filtran y cancelan citas.
  7. ADMIN gestiona usuarios, empleados/cargos, doctores/especialidades.
  8. ADMIN crea/edita franjas de horario de atención respetando cupos reservados.
  9. Recuperación/restablecimiento de contraseña por token.
  10. Sesión se renueva transparentemente cuando expira el access token.

## Tech Stack
### Backend (existente, raíz del repo)
- **Framework:** Fastify 5.12 + TypeScript 6 (ESM), Zod 4 para validación.
- **ORM/Base de datos:** Prisma 7 (driver adapter `@prisma/adapter-pg`) sobre PostgreSQL 17.
- **Auth:** JWT access + refresh (`jsonwebtoken`), hash Argon2 (`@node-rs/argon2`).
- **Docs:** OpenAPI en `/docs/json` vía @fastify/swagger.
### Frontend (en construcción — carpeta `web/`)
- **Framework:** Next.js 15 App Router + React 19 + TypeScript.
- **UI:** Tailwind CSS v4 + shadcn/ui; estado servidor con TanStack Query.
- **Hosting previsto:** Vercel (web), Render free (API Docker), Supabase (Postgres).

## Test Stack
### Unit / Component (API — existente)
- **Framework:** Vitest 4 (`vitest.config.ts` en raíz, tests en `tests/`).
### Unit / Component (web — se configura en esta fase)
- **Framework:** Vitest + Testing Library + jsdom (config en `web/vitest.config.ts`, tests co-ubicados `*.test.tsx`).
### E2E / Integración
- **Framework:** None selected yet — Playwright recomendado como default (ver playwright-automation). Hoy la cobertura E2E se cubre con pruebas de componentes sobre páginas.
### API / Contrato
- **Estado:** None selected yet — el spec OpenAPI de `/docs/json` genera tipos con openapi-typescript (previene deriva); contract testing formal pendiente.

## CI/CD
- **Plataforma:** None yet (sin `.github/workflows`). Previsto tras F7: lint + typecheck + tests en cada push; bloquea merge si fallan. Artefactos a conservar: reporte de cobertura y capturas si se añade visual testing.

## Environments
- **Desarrollo (verificado en F1):** docker-compose local — `db` (postgres:17-alpine, puerto host 5433 → 5432, healthy) + `api` (Fastify, puerto 3000, `/health` responde `{"status":"ok"}`); la web corre fuera de Docker con `npm run dev` en el puerto **3001** y rewrites `/api/v1/*` → `localhost:3000` (verificado con `GET /api/v1/countries` a través del proxy). Orquestador local: podman-compose (CLI compatible con docker).
- **Producción (planeada):** Render free duerme el API tras ~15 min (cold start ~30–60 s); Supabase pausa el proyecto tras ~7 días sin uso (reactivar manual desde dashboard). Paridad de motor DB: PostgreSQL 17 en todos los entornos (sin divergencias de dialecto); mismo pipeline de migraciones (`prisma migrate deploy`) y seed (`db:seed`).
- **Diferencias aceptadas dev↔prod:** HTTP local vs HTTPS gestionado por Vercel/Render; rate limiting idéntico en código; docs Swagger solo fuera de producción.
- **Gap pendiente:** falta `.env.example` versionado con las variables documentadas (añadir en F6 antes de publicar).

## Quality Goals
- Cobertura unitaria (web): ≥ 60% en lógica de negocio (schemas, servicios, guardas de ruta) medida por Vitest/V8.
- Flakiness: < 2% en ventana móvil de 30 días; cero flakes tolerados en suite de sesión local.
- Duración: suite unitaria completa < 3 min; verificación de fase < 10 min.
- Cada tarea cierra con su verificación QA ejecutada (mapeo por grupo en `tasks.md`).

## Risk Areas
| Área | Nivel | Impacto de negocio | Notas |
|---|---|---|---|
| Autenticación/sesión JWT (cookies httpOnly, refresh) | Critical | Acceso no autorizado o cierres masivos de sesión | Renovación 401→refresh→reintento único debe probarse exhaustivamente |
| Reserva de citas y control de cupos | Critical | Sobre-cupos o citas perdidas = daño operativo real | Concurrencia sobre último cupo; estados PA/APUN/ATEN/NA |
| Autorización por rol (PAC/MED/ADMIN/SERVC) | Critical | Exposición de datos clínicos entre roles | Guardas de ruta + ocultamiento de acciones; backend sigue siendo autoridad |
| Deriva de tipos API↔frontend | Important | Pantallas rotas silenciosas tras cambios de backend | Regenerar openapi-typescript tras cada cambio de API |
| Disponibilidad prod (cold starts Render/Supabase) | Monitor | Primera petición lenta en demos (~30–60 s) | Documentado como aceptado; ping programado opcional |

## Team
- **Composición:** solo developer (ratio dev:QA efectivo ∞). El desarrollador es dueño de todas las pruebas; modelo recomendado: automatización de bajo umbral (Vitest + Testing Library ahora, Playwright después) y gates en CI.

## Conventions
- **Nombres de test:** co-ubicados junto al código, patrón `<modulo>.test.ts(x)`; descripciones en español.
- **Branching:** main protegida prevista tras F7; commits convencionales cortos en español.
- **Selectores E2E/componentes:** `data-testid` kebab-case (`data-testid="cita-cancelar-boton"`); complementado con roles ARIA cuando aportan aserción de accesibilidad.
- **Datos de prueba:** seed idempotente vía `npm run db:seed` (roles, catálogos, usuarios demo); factories ligeras en tests con MSW handlers por módulo.
- **Validación:** esquemas Zod del frontend espejan los contratos `*.schemas.ts` del backend.
