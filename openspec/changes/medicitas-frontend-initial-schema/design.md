# Diseño: Esquema inicial del frontend mediCitas

## Context

La API Fastify (`src/app.ts`) expone `/api/v1/*` con OpenAPI en `/docs/json`, autenticación JWT (access + refresh, ver `src/modules/auth/token.service.ts`), errores normalizados (`src/shared/errors/codes.ts`) y paginación compartida (`src/shared/pagination/pagination.ts`). El modelo relacional (18 tablas) ya está mapeado en `prisma/schema.prisma`. No existe ningún frontend. La app web vivirá en `web/` dentro del mismo repositorio y consumirá la API por HTTP; no comparte proceso con el backend.

## Goals / Non-Goals

**Goals:**
- SPA Next.js operable para los cuatro roles desde el primer despliegue.
- Tipos de API generados desde OpenAPI, sin duplicación manual.
- Sesión JWT segura en navegador con renovación transparente.
- Estructura de módulos espejo de los dominios del backend (`web/src/modules/...`) para que cada capacidad sea localizable.

**Non-Goals:**
- No se modifica backend ni su esquema Prisma.
- Sin landing pública de marketing (SEO técnico limitado a metadatos/estructurados de las rutas públicas: login, registro, recuperación).
- Sin i18n (español único), sin modo offline, sin notificaciones push (cambio `medicitas-notifications` las cubrirá).
- Sin reprogramación de citas (solo crear y cancelar) hasta confirmar reglas de negocio.

## Decisions

1. **Next.js 15 App Router en `web/` (no monorepo pnpm todavía).** Un solo repositorio con dos apps independientes es lo más simple hoy; migrar a workspace es mecánico más adelante. Alternativa descartada: Vite SPA (preferida por el usuario era Next.js por posible SEO futuro) y Angular/Vue (mayor fricción con el ecosistema TS/zod existente).
2. **Cliente API tipado con openapi-typescript.** Se genera `web/src/shared/api/schema.d.ts` desde `/docs/json` mediante script npm (`api:schema`). Fetch wrapper tipado centraliza base URL, cabeceras y mapeo de códigos de error del backend a mensajes de UI. Alternativa descartada: cliente escrito a mano (deriva de tipos) o tRPC (requeriría tocar el backend).
3. **Sesión vía cookies httpOnly establecidas por Route Handlers de Next.js.** Tras login, el Route Handler `/web/api/auth/session` recibe access+refresh de la API, fija cookies httpOnly/SameSite=Lax y devuelve solo el perfil al cliente. Las llamadas a la API pasan por un Route Handler proxy o adjuntan el token leído server-side; así los refresh tokens nunca tocan `localStorage` (XSS-safe). Renovación: interceptor 401 → POST refresh → reintento único → si falla, logout. Alternativa descartada: tokens en localStorage (vulnerable a XSS).
4. **Autorización en dos capas:** middleware/route-protection por rol en el shell (redirects) + guardas en cada vista que oculta/bloquea acciones no permitidas. Los roles se leen del perfil en sesión; el backend sigue siendo la autoridad final.
5. **Estado de servidor con TanStack Query; estado global mínimo.** Query keys por dominio (`['specialties']`, `['doctors', filters]`, `['appointments', filters]`); catálogos con `staleTime` largo (requisito de reutilización en sesión). Sin Redux/Zustand: sesión y preferencias viven en un contexto React ligero.
6. **Formularios con react-hook-form + zod.** Los esquemas zod del frontend replican los contratos de `*.schemas.ts` del backend; se colocan en `web/src/modules/<dominio>/schemas.ts`. DNI, correo y tipo de sangre validados contra catálogos/regex equivalentes al backend.
7. **UI con Tailwind CSS v4 + shadcn/ui**, tema claro accesible, componentes de tabla/paginación propios sobre shadcn reutilizando el contrato de paginación del backend (`page`, `limit`, `total`). Fechas y horas en formato es-HN local.
8. **Pruebas con Vitest + Testing Library** (unitarias de schemas/servicios y de componentes clave: login, registro, flujo de agendamiento). Playwright queda como non-goal inicial.
9. **Estructura de carpetas espejo de capacidades:**

```
web/
  src/
    app/                    # rutas App Router (públicas /auth/*, privadas /(app)/*)
      api/auth/session/     # route handler de cookies
    modules/
      auth/ profiles/ catalogs/
      staff-admin/ schedules/ appointments/
        {routes,schemas,services,components}/
    shared/{api,ui,lib,hooks}/
```

10. **Proxy de API en desarrollo** con rewrites de `next.config.ts`: `/api/v1/*` → `http://localhost:3000/api/v1/*`; en producción `API_URL` apunta al servicio real (ya orquestado en `docker-compose.yml`, se añadirá servicio `web`).
11. **QA por tarea con skills del estándar Agent Skills.** Se instalan las skills de `petrkindlmann/qa-skills` (`npx skills add petrkindlmann/qa-skills`) y se crea `.agents/qa-project-context.md` una sola vez; la verificación de cada tarea de implementación se ejecuta con la skill mapeada a su grupo (unit-testing, api-testing, accessibility-testing, test-environments). Alternativa descartada: verificación manual ad hoc (no trazable ni repetible).
12. **Test de seguridad integral antes de publicar.** Al completar todas las tareas se ejecuta una evaluación con skills de `mukul975/Anthropic-Cybersecurity-Skills` (`npx skills add mukul975/Anthropic-Cybersecurity-Skills`), dominios Web Application Security y API Security: OWASP Top 10 sobre la web (XSS, control de acceso roto, gestión de sesión) y sobre la API (authN/authZ, inyección, exposición de datos). Los hallazgos críticos/high bloquean la publicación. Alcance limitado a sistemas propios en local/docker.
13. **Publicación en GitHub como paso final condicionado.** El repo local no es git aún: se inicializa, se comprueba que `.gitignore` excluye `.env`, `node_modules`, `dist` y artefactos generados, y se hace push a `https://github.com/Angel12328/mediCitas.git` solo tras aprobar el test de seguridad.
14. **Despliegue continuo en Vercel conectado al repositorio.** Se importa `Angel12328/mediCitas` en Vercel con Root Directory = `web/` (detecta Next.js sin configuración extra): push a `main` → build de producción; ramas/PRs → deployments de preview con URL propia. Variables de entorno (`API_URL`) se definen en el dashboard de Vercel para producción y preview. Alternativa descartada: despliegue manual vía Vercel CLI (rompe la trazabilidad push→deploy) o Docker propio en VPS (más operación para un portafolio).
15. **API en Render (free) + base de datos en Supabase (free).** `render.yaml` declara únicamente el web service que construye el `Dockerfile` existente del API (sin recurso de base de datos). La base Postgres vive en un proyecto Supabase free, que no caduca ni borra datos: el API recibe la cadena de conexión por la variable secreta `DATABASE_URL` (fijada en el dashboard de Render, `sync: false` en el blueprint), y migraciones/seed (`prisma migrate deploy` + `npm run db:seed`) se ejecutan una vez contra Supabase. Push a `main` redespliega el API (auto-deploy); la URL HTTPS pública asignada por Render es el `API_URL` de Vercel. Alternativas descartadas: Postgres managed de Render (expira ~30 días borrando datos), Railway (crédito mensual), Fly.io (verificación con tarjeta), VPS Oracle (setup manual mayor), túnel ngrok (no permanente).
16. **Diseño de UI guiado por `ibelick/ui-skills`.** Se instalan las skills de diseño engineering (`npx skills add ibelick/ui-skills`; también disponibles vía CLI/MCP de ui-skills.com) y se consultan al definir tokens (espaciado, tipografía, color), componentes shadcn personalizados, motion/micro-interacciones y estados de interfaz (hover/focus/loading/error). El playbook de ui-skills sirve como checklist de revisión visual final. Alternativa descartada: diseñar ad hoc sin guía (resultados inconsistentes entre módulos).
17. **SEO técnico en rutas públicas con `coreyhaines31/marketingskills`.** La app es transaccional detrás de login; el alcance SEO se limita a las superficies públicas (raíz, login, registro, recuperación): Metadata API de Next.js (title/description/canonical), Open Graph/Twitter cards, `robots.txt`, `sitemap.xml`, HTML semántico y JSON-LD `MedicalClinic` con la skill `schema`. Auditoría con `seo-audit`/`ai-seo`. Se crea `.agents/product-marketing.md` con la skill `product-marketing` (contexto que las demás skills leen primero). Alternativa descartada: omitir SEO por completo (la web pública queda invisible ante buscadores y previews sin OG).

## Risks / Trade-offs

- [Cookies httpOnly obligan a que toda petición pase por servidor Next.js o proxy] → Se centraliza en el wrapper de API; las lecturas server-side usan fetch directo con cookie reenviada. Documentado en tasks.
- [OpenAPI generado puede desincronizarse] → Script `api:schema` en CI + typecheck; regenerar tras cambios de backend.
- [Doble definición de validaciones (backend zod vs frontend zod)] → Aceptado temporalmente; extracción a paquete compartido cuando haya workspace.
- [Estados de cita PA/APUN ambiguos para UI] → Se etiquetan literalmente ("Por atender", "Apuntado"); solo MÉDICO marca ATEN/NA, ADMIN/SERVC cancelan. Confirmable sin cambiar specs.
- [CORS en producción entre dominios web/api] → Backend ya usa `@fastify/cors`; añadir origen de la web a configuración de entorno.
- [Skills externas pueden quedar desactualizadas respecto a amenazas actuales] → Se fijan versiones/clones con fecha y se registra en el informe qué versión se usó; el OWASP Top 10 es estable como base.
- [Publicar accidentalmente secretos (.env, JWT secrets)] → Verificación previa al push: `.gitignore` cubre `.env`, `git status` revisado, sin credenciales reales en docker-compose (solo valores dev por defecto ya existentes).
- [Render free duerme el API tras ~15 min de inactividad] → Primera petición tras pausa tarda ~30-60 s; aceptado para portafolio. Mitigación opcional futura: ping programado (cron/UptimeRobot) o plan de pago.
- [Supabase free pausa el proyecto tras ~7 días sin actividad] → Los datos NO se pierden; reactivar desde el dashboard (~1 minuto). Mitigación futura: upgrade o ping programado.

## Migration Plan

Ejecución **por fases de 2 grupos de tareas** (ver tabla al inicio de `tasks.md`): F1 andamiaje → F2 auth/shell → F3 catálogos/registro → F4 perfiles/admin → F5 horarios/citas → F6 integración+seguridad → F7 publicación. Cada fase cierra en su checkpoint y espera confirmación antes de la siguiente.

1. Crear `web/` con Next.js scaffold y tooling (lint/format alineados al repo).
2. Implementar shared (api client, sesión, ui) y luego módulos por capacidad en orden: auth → catalogs → profiles → patient-onboarding → staff-admin → schedules → appointments.
3. Despliegue: integración local con servicio `web` en `docker-compose.yml`; hosting de producción en Vercel conectado al repositorio (push a `main` → despliegue automático). Rollback en Vercel = promover el deployment anterior; el backend nunca cambia.

## Open Questions

- ¿Puerto/host definitivo de la web en producción? (no bloquea diseño; Vercel lo asigna y es configurable por dominio propio)
- ¿Reprogramación de citas en fase 2? (requerirá reglas de negocio antes de especificar)
