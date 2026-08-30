## Context

Estado actual: `AgendarWizard` usa dropdowns (especialidad → doctor → fecha) y lista simple de horarios con botones "Reservar". Backend expone `/schedules/availability` (doctor + especialidad + fecha → slots con cupos) y `/appointments` POST para crear cita. Frontend usa TanStack Query, componentes UI (Card, Dialog, Button, Input, Label), tema teal médico en `globals.css`.

Constraints:
- No cambios en API/backend - reutilizar endpoints y hooks existentes
- Mantener compatibilidad con `useAvailability`, `useBookAppointment`, `useDoctores`, `useEspecialidades`
- Componentes UI existentes (shadcn/ui + Tailwind) son la base visual
- Mobile-first, responsivo, accesible (WCAG 2.2 AA)
- Deployment: Vercel (frontend: https://web-alpha-ecru-99.vercel.app), Render (backend: https://medicitas-api.onrender.com), Repo: https://github.com/Angel12328/mediCitas.git

## Goals / Non-Goals

**Goals:**
- Reescribir `AgendarWizard` como wizard de 2 pasos con state machine clara
- Doctor cards grid usando `Card` component, datos de `useDoctores` + `useAvailability` para próximo slot
- Calendario mensual custom (no librería externa) con indicadores de disponibilidad computados desde `useAvailability`
- Filtros: `Select` para especialidad (`useEspecialidades`) + `Input` búsqueda doctor (filtro client-side sobre `useDoctores`)
- Paso 2: `Dialog` con resumen, botón "Confirmar Cita" llama `useBookAppointment`
- Accesibilidad: roles ARIA, foco visible, navegación teclado, lectores pantalla
- **Aplicar ui-skills**: baseline-ui (spacing, hierarchy, typography), improve-ui (audit against design evidence), fixing-accessibility (ARIA, keyboard, contrast), fixing-motion-performance (animations)
- **Aplicar marketingskills**: SEO metadata (title, description, OG, Twitter), JSON-LD schema (MedicalBusiness, Appointment), AI-SEO (llms.txt, citations)
- **Aplicar qa-skills**: Test planning, test reliability (flaky healing), accessibility testing (axe-core), visual testing (Playwright screenshots)
- **Aplicar security-skills**: OWASP ZAP DAST integration, API security testing (OWASP API Top 10), XSS testing post-implementation
- **Deployment automatizado**: GitHub Actions → Vercel (frontend) + Render (backend) on push to main

**Non-Goals:**
- Nueva librería de calendario (date-fns/dayjs solo para utilidades de fecha)
- Cambios en API, esquema BD, o hooks de datos
- Notificaciones, lista de espera, reprogramación
- Internacionalización (fecha/hora en locale actual)
- Cambios en backend logic (solo deployment config)

## Decisions

### Decision 1: State machine de 2 pasos en `AgendarWizard`

**Elección:** `type Step = 'select' | 'confirm';` con `useState<Step>` y `useState<Selection>` donde `Selection = { specialtyId?: string; doctorId: string; date: string; scheduleId: string }`.

**Rationale:** Separación clara de responsabilidades. Paso 1 = recopilación + validación; Paso 2 = presentación + confirmación. Fácil de testear y extender (ej. paso 3 "éxito").

**Alternativas:**
- Wizard multi-componente (over-engineering para 2 pasos)
- Todo en un componente con flags booleanas (menos mantenible)

### Decision 2: Doctor cards grid con próximo horario disponible

**Elección:** En paso 1, tras seleccionar especialidad y fecha, hacer fetch de `useAvailability` para cada doctor mostrado (o batch via `useAvailability` con doctorId undefined + specialtyId + date). Card muestra `doctor.fullName`, `specialtyName`, y `nextSlot = slots.find(s => s.available > 0)?.startTime`.

**Rationale:** Un doctor puede tener múltiples horarios; mostrar solo el próximo con cupo reduce ruido cognitivo. Batch fetch evita N+1.

**Alternativas:**
- Mostrar todos los horarios en card (demasiado denso)
- Solo nombre/especialidad, click → modal con horarios (click extra)

### Decision 3: Calendario mensual custom con indicadores

**Elección:** Componente `MonthCalendar` que recibe `availabilityByDate: Map<string, AvailabilitySlot[]>` (clave ISO date). Renderiza grid 6x7 (semanas x días). Cada celda: número de día + indicador (dot verde si `slots.some(s => s.available > 0)`). Click en día habilitado → `onDateSelect(date)`.

**Rationale:** Sin dependencias pesadas. `useAvailability` ya devuelve slots por fecha; agregamos `useEffect` que al cambiar mes hace fetch para cada día del mes (o range). 28-31 fetches/mes es aceptable (cached por TanStack Query).

**Alternativas:**
- `react-day-picker` (añade ~15kb, overkill)
- Input type="date" + lista (pierde visión mensual)

### Decision 4: Filtros separados con estado derivado

**Elección:** `specialtyId` (Select) y `doctorSearch` (Input) en estado local. `filteredDoctors = useMemo(() => doctors.filter(d => (!specialtyId || d.specialties?.includes(specialtyId)) && (!doctorSearch || d.fullName.toLowerCase().includes(doctorSearch.toLowerCase()))), [doctors, specialtyId, doctorSearch])`.

**Rationale:** Filtro client-side instantáneo, sin round-trip. `useDoctores` ya trae página completa (pageSize=10, pero especialidades tienen pocos doctores).

**Alternativas:**
- Server-side filtering (latencia en cada keystroke)
- Solo dropdown especialidad (pierde búsqueda por nombre)

### Decision 5: Dialog de confirmación (Paso 2)

**Elección:** `Dialog` de shadcn/ui con `DialogHeader` (título "Confirmar cita"), `DialogContent` (resumen formateado), `DialogFooter` (Button variant="outline" onClick={goBack}, Button onClick={confirm}).

**Rationale:** Modal enfoca atención, previene clicks accidentales, accesible por defecto (trap focus, ESC para cerrar). Reutiliza componente existente.

**Alternativas:**
- Página separada `/citas/agendar/confirmar` (routing extra, pierde estado fácil)
- Inline panel (menos énfasis en acción irrevocable)

### Decision 6: Formateo de fecha/hora en locale

**Elección:** `new Date(`${date}T${startTime}`).toLocaleDateString('es-HN', { weekday: 'long', day: 'numeric', month: 'long' })` y `startTime.slice(0,5)` para hora.

**Rationale:** Usuario en Honduras (timezone America/Tegucigalpa en Schedule). `toLocaleDateString` respeta locale del navegador.

### Decision 7: Accesibilidad - cards como botones

**Elección:** Doctor card = `<button className="card-wrapper" onClick={selectDoctor} aria-pressed={selected} aria-disabled={!hasAvailability}>...` con `role="button"` implícito. Calendario: `role="grid"`, cada día `role="gridcell"`, día seleccionado `aria-selected="true"`, con disponibilidad `aria-label="Disponible, 3 horarios"`.

**Rationale:** Nativos `<button>` y `role="grid"` son patrones ARIA estándar. Evita `div` + `tabIndex` + key handlers manuales.

### Decision 8: UI Design System con ui-skills

**Elección:** Aplicar 4 skills de ui-skills en secuencia:
1. `baseline-ui` - Fix spacing, hierarchy, typography, layout issues en componentes nuevos
2. `improve-ui` - Audit contra design evidence, identificar UI problems, implementation plans
3. `fixing-accessibility` - ARIA labels, keyboard navigation, focus management, color contrast, form errors
4. `fixing-motion-performance` - Animation performance, layout thrashing, compositor properties

**Rationale:** Skills especializadas cubren todo el lifecycle de UI quality. baseline-ui = quick wins; improve-ui = systematic audit; fixing-accessibility = WCAG 2.2 AA compliance; fixing-motion-performance = 60fps animations.

**Alternativas:**
- Manual CSS/Tailwind audit (inconsistente, time-consuming)
- Solo shadcn/ui defaults (no cubre motion, accessibility depth)

### Decision 9: SEO Optimization con marketingskills

**Elección:** Aplicar 4 skills de marketingskills:
1. `fixing-metadata` - Page title, meta description, canonical, OG tags, Twitter cards, favicons, JSON-LD, robots
2. `seo-audit` - Technical SEO audit de la página `/citas/agendar`
3. `schema` - JSON-LD structured data: MedicalBusiness, Physician, MedicalProcedure, Appointment
4. `ai-seo` - Optimize for AI citations (llms.txt, OKF, agent-readable content)

**Rationale:** Página de agendamiento es high-value conversion page. SEO técnico + structured data + AI visibility = organic + AI-driven traffic.

**Alternativas:**
- Solo meta tags básicos (pierde rich snippets, AI citations)
- Schema.org genérico (no específico a medical/appointment)

### Decision 10: QA Testing Strategy con qa-skills

**Elección:** Aplicar 4 skills de qa-skills:
1. `test-planning` - Sprint test plan para agendamiento feature
2. `test-reliability` - Flaky test healing, selector healing, quarantine management
3. `accessibility-testing` - axe-core + Playwright, keyboard nav audit, screen reader testing, ARIA validation
4. `visual-testing` - Playwright screenshots, Chromatic/Percy/Argos CI, baseline management

**Rationale:** Coverage completa: planning → reliability → accessibility → visual regression. Skills integradas en CI/CD.

**Alternativas:**
- Solo unit tests (pierde integration, accessibility, visual)
- Manual QA only (no scalable, no regression protection)

### Decision 11: Security Testing con Anthropic-Cybersecurity-Skills

**Elección:** Post-implementation security testing usando 3 skills:
1. `integrating-dast-with-owasp-zap-in-pipeline` - OWASP ZAP en GitHub Actions (baseline, full, API scan)
2. `testing-api-security-with-owasp-top-10` - REST API testing contra OWASP API Top 10 (auth, rate limiting, input validation)
3. `testing-for-xss-vulnerabilities` - XSS testing (reflected, stored, DOM-based) con Burp Suite payloads

**Rationale:** Agendamiento maneja PII (patient data, appointments). Security testing automatizado en CI + manual validation post-deploy.

**Alternativas:**
- Solo SAST (Semgrep) - no catch runtime vulns
- Solo manual pentest - no continuous, expensive

### Decision 12: Deployment - Vercel + Render con GitHub Actions

**Elección:** GitHub Actions workflow (`.github/workflows/deploy.yml`) con 2 jobs:
- `deploy-frontend`: Vercel CLI action, `vercel --prod --token=${VERCEL_TOKEN}`, alias `web-alpha-ecru-99.vercel.app`
- `deploy-backend`: Render Deploy Hook o `render.yaml` sync, backend en `medicitas-api.onrender.com`

**Configuración Vercel:** `vercel.json` con `buildCommand: "npm run build"`, `outputDirectory: ".next"`, `framework: "nextjs"`, env vars desde Vercel dashboard

**Configuración Render:** `render.yaml` existente define `medicitas-api` service usando `Dockerfile` para deploy, con `autoDeploy: true`; auto-deploy on push a main

**Rationale:** Zero-config deploy on push. Vercel optimizado para Next.js. Render para Node.js/PostgreSQL backend. GitHub Actions orquesta ambos.

**Alternativas:**
- Vercel + Render dashboards manual (no automated)
- Netlify + Railway (vendor switch, migration effort)

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|------------|
| Fetch de disponibilidad por cada doctor en cards (N+1) | Usar `useAvailability` con `doctorId` undefined + `specialtyId` + `date` para traer todos los slots de la especialidad en una query, luego agrupar por doctor en cliente |
| Calendario hace 28-31 queries al cambiar mes | TanStack Query cachea por `queryKey`; `staleTime` alto (catálogos 24h, availability menor). Prefetch mes adyacente en `onMonthChange` |
| Estado de selección perdido al navegar fuera | Wizard es client-only; si usuario recarga, vuelve a `/citas/agendar` paso 1 limpio (comportamiento aceptable) |
| Doctor cards en móvil: scroll horizontal vs wrap | Grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` con `gap-4`; wrap natural, sin scroll horizontal |
| Zona horaria: Schedule usa `America/Tegucigalpa`, calendario usa local | Fecha en `useAvailability` se envía como `YYYY-MM-DD` (date only). Backend interpreta en TZ del consultorio. Frontend formatea para display en local del usuario |
| UI skills añaden overhead de revisión | Ejecutar baseline-ui + improve-ui en PR review, fixing-accessibility + fixing-motion-performance en CI gate |
| SEO skills requieren contenido médico válido | Validar con schema.org MedicalBusiness, Physician types; contenido revisado por domain expert |
| QA skills aumentan CI time | Parallel jobs: unit/integration || accessibility || visual || security; target <10min total |
| Security skills false positives | ZAP baseline scan (low false positive), API security tests targeted, XSS manual validation |
| Deploy dual Vercel+Render race condition | Independent jobs, no shared state; backend deploy first (Render), then frontend (Vercel) |

## Migration Plan

1. Crear nuevo `AgendarWizardV2` junto al actual (feature flag o ruta temporal `/citas/agendar/v2`)
2. Test manual QA en staging con datos reales
3. Switch página `/citas/agendar/page.tsx` a nuevo componente
4. **Aplicar ui-skills**: baseline-ui → improve-ui → fixing-accessibility → fixing-motion-performance en componentes nuevos
5. **Aplicar marketingskills**: fixing-metadata → seo-audit → schema → ai-seo en `/citas/agendar/page.tsx`
6. **Aplicar qa-skills**: test-planning → test-reliability → accessibility-testing → visual-testing en CI
7. **Aplicar security-skills**: OWASP ZAP baseline scan en CI, API security tests, XSS validation post-deploy
8. **Configurar deployment**: `.github/workflows/deploy.yml`, `vercel.json`, verificar `render.yaml`
9. Push a main → GitHub Actions deploys a Vercel (frontend) + Render (backend)
10. Validar en producción: https://web-alpha-ecru-99.vercel.app/citas/agendar + https://medicitas-api.onrender.com
11. Eliminar `AgendarWizard` viejo
12. Rollback: revert page.tsx import + GitHub Actions revert

## Open Questions

- ¿Necesita el calendario mostrar festivos/días no laborables del consultorio? (Fuera de scope, backend no expone esa info hoy)
- ¿Debe el wizard persistir selección en `sessionStorage` para sobreviver recarga accidental? (Nice-to-hold, no bloquea MVP)
- ¿Schema.org MedicalProcedure requiere códigos específicos (SNOMED/CT)? (Usar placeholder, refinar post-MVP)
- ¿OWASP ZAP full scan en CI o solo baseline? (Baseline en CI, full scan nightly/scheduled)
- ¿Visual testing baselines en Chromatic (gratis) o Percy/Argos? (Chromatic free tier para empezar)