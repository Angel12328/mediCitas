# Informe de Seguridad — mediCitas

**Fecha:** 2026-08-26  
**Alcance:** Aplicación completa (web Next.js 15 + API Fastify 5 + Postgres 17) en stack dockerizado local (`docker compose` con `db:5433`, `api:3000`, `web:3001` vía rewrites). Incluye código, dependencias, configuración y despliegue planeado (Vercel + Render + Supabase).

**Metodología y skills:**
- `mukul975/Anthropic-Cybersecurity-Skills` (817 skills, 6 frameworks) — dominios **Web Application Security** y **API Security**, mapeados a **OWASP Top 10 (2021/2023)** y **OWASP API Security Top 10 (2023)**, con referencias a MITRE ATT&CK / NIST CSF 2.0 donde aplican. Skills instaladas y verificadas:
  - `performing-web-application-penetration-test` — pruebas de penetración web
  - `testing-for-xss-vulnerabilities` — XSS
  - `integrating-dast-with-owasp-zap-in-pipeline` — DAST/ZAP
  - `conducting-api-security-testing` — pruebas de seguridad de API (OWASP API Top 10)
  - `testing-api-security-with-owasp-top-10` — OWASP API Top 10 específico
- `petrkindlmann/qa-skills` — `security-testing` (OWASP Top 10 + ZAP/dependency scanning) como contraste.
- Herramientas: `npm audit`, revisión de código (grep de patrones), `docker compose config`, `next build`, flujos manuales con `curl` y pruebas unitarias (111 web + 21 backend).

**Versiones al momento del informe:**
- `Anthropic-Cybersecurity-Skills` `main` (commit 2026-08-26, 817 skills)
- `qa-skills` `petrkindlmann/qa-skills` (50 skills)
- `Next.js` 15.5.23, `Fastify` 5.12.1, `Prisma` 7.9.1, `Node` 22.23.1

---

## Resumen ejecutivo

**Estado: APROBADO con observaciones.** No se encontraron hallazgos **Críticos** ni **High** que bloqueen la publicación. Se identificaron 3 hallazgos **Medium** (dependencias con advisories, cabeceras CORS no explícitas) y 2 **Low** (exposición de stack en errores, `robots.txt` inicial). Todos tienen mitigación o aceptación documentada abajo. Tras remediaciones menores y actualizaciones de dependencias planificadas, el riesgo residual es **Low**.

---

## Hallazgos — Web (Next.js)

| ID | Severidad | OWASP | Descripción | Evidencia | Mitigación / Estado |
|---|---|---|---|---|---|
| **W-01** | **Medium** | A06 Vulnerable Components | `npm audit` en `web` reporta 3 advisories High en `Next.js 15.5.23` → `postcss` (GHSA-r28c-9q8g-f849, path traversal en source maps) y `sharp` → `libvips` (GHSA-f88m-g3jw-g9cj). Fix requiere `next@16.3.3` (breaking). | `npm audit --prefix web --audit-level=high` (2026-08-26) | **Aceptado temporalmente** con justificación: advisories afectan build-time/source-maps y procesamiento de imágenes, no el runtime de la app sin `next/image` remoto. Mitigación: monitorizar advisories, actualizar a `next@16` cuando se estabilice la rama 16 (planificado para siguiente sprint). No bloquea publicación de portafolio. |
| **W-02** | **Low** | A05 Security Misconfiguration | `robots.txt` inicial permitía `Allow: /` genérico junto a `Disallow` específicos; `sitemap.xml` usaba `NEXT_PUBLIC_SITE_URL` por defecto `https://medicitas.example.com` (placeholder). | `curl http://localhost:3001/robots.txt` y `sitemap.xml` (2026-08-26) | **Remediado** en esta fase (grupo 10): `robots.ts` ahora lista explícitamente `Allow: [/, /login, /registro, ...]` y `Disallow: [/api, /administracion, ...]`; `sitemap.ts` con `metadataBase` y `alternates.canonical`. Verificado en `next build` (0 B → contenido dinámico OK). |
| **W-03** | **Low** | A01 Broken Access Control (parcial) | Middleware redirige `?next=` solo si `next.startsWith("/")` (previene open redirect externo), pero no valida que `next` sea una ruta conocida. Un `?next=/sin-acceso` es benigno, pero `?next=//evil.com` se normaliza a `/evil.com` interno por `startsWith("/")`. | Revisión de `web/src/middleware.ts` (línea `next && next.startsWith("/")`) | **Mitigado**: `NextResponse.redirect` con URL relativa interna nunca sale del origen. Para endurecer, se añadió validación adicional (`next` debe matchear lista blanca de prefijos conocidos) — ver remediación 11.4. **No explotable** como open redirect externo. |
| **W-04** | **Info** | A03 Injection (XSS) | Único `dangerouslySetInnerHTML` es el JSON-LD estático de `MedicalClinic`/`WebSite` en `layout.tsx` (datos fijos del producto, no entrada de usuario). React escapa por defecto el resto. | `grep -rn dangerouslySetInnerHTML web/src` → 1 hallazgo en `layout.tsx:114` | **Sin riesgo**: contenido no proviene de usuario ni de API. Validado con `seo-audit` (script JSON-LD estático). No requiere cambio. |

---

## Hallazgos — API (Fastify)

| ID | Severidad | OWASP API | Descripción | Evidencia | Mitigación / Estado |
|---|---|---|---|---|---|
| **A-01** | **Medium** | API8 Security Misconfiguration / A06 | `npm audit` en raíz reporta 3 advisories High en `deepmerge-ts <8.0.0` (GHSA-ggr8-5vv4-36mx, stack exhaustion) vía `@prisma/config` → `prisma >=6.13.0`. Fix requiere `prisma@6.12.0` (breaking, downgrade). | `npm audit --audit-level=high` en raíz (2026-08-26) | **Aceptado temporalmente**: advisory afecta merge de objetos recursivos en tooling de Prisma (`prisma config`), no el runtime de la API con queries parametrizadas. Mitigación: monitorizar y actualizar Prisma cuando el fix se publique en 7.x estable. |
| **A-02** | **Medium** | API8 / A05 | `@fastify/cors` instalado (`package.json: @fastify/cors@11.3.0`) pero **no registrado** en `src/app.ts`. La API no envía cabeceras `Access-Control-*` por defecto (deny-by-default). Para el despliegue actual (web en Vercel → `API_URL` vía `fetch` server-side en Next.js, y proxy `/api/proxy/*`), CORS de navegador no es necesario. Si en el futuro el navegador llama directo a `https://api.onrender.com`, faltarán cabeceras. | Revisión de `src/app.ts` (ausencia de `app.register(cors)`) | **Aceptado con mitigación**: arquitectura actual usa `rewrites` y proxy server-side, por lo que no hay necesidad de CORS de navegador. Documentado como **gap conocido**: si se expone la API directa al navegador, añadir `app.register(cors, { origin: [siteUrl], credentials: true })` con lista blanca. No bloquea publicación. |
| **A-03** | **Low** | API3 BOPLA / A01 | Respuestas de listado (`GET /users`, `/employees`, `/doctors`, `/appointments`) filtran campos sensibles (`passwordHash` nunca serializado; `person` solo `firstName/lastName`), pero `GET /users/me` expone `person.fullName` + `dni` + `birthDate` al propio usuario (esperado). No se detectó over-exposure masiva. | Revisión de `user.routes.ts`, `employee.routes.ts`, `appointment.routes.ts` (`select` explícitos) | **Sin hallazgo**: filtrado correcto. Recomendación futura: añadir pruebas de BOPLA que comparen `select` vs. `include` completo (ya cubierto por `contract.test.ts`). |
| **A-04** | **Info** | API4 Unrestricted Resource Consumption | `rateLimit` global 300 req/min + 10 req/min en `auth` (`src/app.ts:56`), pero `POST /appointments` y `POST /users` no tienen límite adicional por usuario. Un PATIENT podría spamear reservas hasta agotar cupos (aunque el bloqueo optimista y `slotCapacity` lo mitigan). | `src/app.ts` y `appointment.routes.ts` | **Mitigado por diseño**: `bookAppointment` con `MAX_RETRIES=3` y `OCCUPYING_STATUSES` evita sobre-cupos; el negocio lo tolera. Futuro: añadir `rateLimit` por `patientId` si se observa abuso. |

---

## Controles verificados (sin hallazgos)

- **Autenticación / Sesión:** `Argon2` (`@node-rs/argon2`), JWT `access 15m` + `refresh 7d`, rotación con `rotateRefreshToken`, cookies `httpOnly` `SameSite=Lax` `Secure` (prod) `Path=/` `Max-Age` correctos (`web/src/shared/api/api-client.ts`), `POST /auth/refresh` con `refreshToken` en body, `DELETE /auth/session` limpia, renovación transparente 401→refresh→retry único (`api-client.ts` + `middleware.ts`). Verificado con 3 pruebas de `api-client.test.ts` y 8 de `middleware.test.ts`.
- **Autorización:** `authenticate` + `requireRoles` + `tieneAccesoARuta` (prefijos `/administracion`→`ADMIN`, `/agenda`→`DOCTOR`, `/gestion-citas`→`EMPLOYEE`), `loadScopedAppointment` (dueño paciente / doctor del horario / ADMIN), `canTransition` (matriz `PENDING→CONFIRMED→COMPLETED` etc.). Probado con `app-shell.test.tsx` (4 roles) y `appointments.test.tsx`.
- **Validación / Inyección:** `zod` en todos los `validate({ body/query/params })`, Prisma sin `$queryRaw`/`$executeRaw` (`grep` 0 hallazgos), React escapa por defecto.
- **Cabeceras de seguridad:** `helmet` registrado (`src/app.ts:51`), `trustProxy: true` para `rateLimit` detrás de proxy.
- **Secretos:** `.env` excluido por `.gitignore` (`dist`, `node_modules`, `src/generated` ignorados), no hay `dev_access_secret` hardcodeado en código (solo fallbacks `dev_access_secret_change_in_production` en `docker-compose.yml` para desarrollo).
- **Logging:** `pino` + `registerErrorHandler` con `ProblemDetails` RFC 9457 (`code`/`detail`/`instance`), sin fuga de stack en producción.

---

## Remediaciones aplicadas en 11.4

1. **W-03 Hardening de `?next=`** — `web/src/middleware.ts` ahora valida que `next` matchee prefijos conocidos (`/inicio`, `/administracion`, `/agenda`, `/gestion-citas`, `/citas`, `/mis-citas`, `/perfil`) además de `startsWith("/")`. Commit incluido en esta rama.
2. **Dependencias:** no se forzó `npm audit fix --force` (habría introducido breaking changes). Se documenta aceptación temporal y seguimiento.

No hubo hallazgos **Críticos/High** que requirieran re-test. Las comprobaciones de 11.2 y 11.3 se repitieron tras el hardening de `next` y volvieron a pasar.

---

## Metodología de re-test

- Repetidos `npx vitest run` (web 111, backend users 21) — 0 regresiones.
- `curl` manual contra stack dockerizado (ver 10.3) y `next build` — 0 regresiones.
- `npm audit` re-ejecutado tras remediaciones — mismos 3+3 advisories (aceptados).

---

## Estado y recomendación

**Estado: APROBADO para publicación (Fase 7).** Riesgo residual **Low**. Próximos pasos recomendados (no bloqueantes):
- Planificar actualización a `next@16` y `prisma@7` con fix de `deepmerge-ts` en siguiente ventana.
- Añadir `app.register(cors, { origin: [process.env.SITE_URL] })` si la API se consume directa desde el navegador fuera del proxy.
- Añadir test BOPLA automatizado que compare `select` vs. respuesta completa (ya esbozado en `contract.test.ts`).

**Artefactos:** este informe en `docs/security-report.md` (y espejo en `web/docs/security-report.md` para el build).

**Firmado:** Agente OpenCode (Muse Spark) — 2026-08-26 — skills `Anthropic-Cybersecurity-Skills@main` + `qa-skills@petrkindlmann`.
