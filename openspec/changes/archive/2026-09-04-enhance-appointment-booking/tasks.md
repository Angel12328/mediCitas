## 1. Componentes base y utilidades

- [x] 1.1 Crear componente `DoctorCard` en `web/src/modules/appointments/components/doctor-card.tsx` que reciba `doctor`, `nextSlot`, `selected`, `onSelect`, `disabled` y renderice `Card` con nombre, especialidad, próximo horario; verificar que se renderiza correctamente en Storybook o página de prueba
- [x] 1.2 Crear componente `MonthCalendar` en `web/src/modules/appointments/components/month-calendar.tsx` que reciba `selectedDate`, `availabilityByDate: Map<string, AvailabilitySlot[]>`, `onDateSelect`, `onMonthChange`; renderice grid 6x7 con indicadores de disponibilidad; verificar navegación mes anterior/siguiente y selección de fecha
- [x] 1.3 Crear hook `useAvailabilityByDateRange` en `web/src/modules/appointments/hooks/use-availability-by-date-range.ts` que dado `specialtyId`, `dateRange: {start: Date, end: Date}` haga fetch de availability para cada día del rango (usa `useAvailability` internamente o fetch directo) y devuelva `Map<string, AvailabilitySlot[]>`; verificar que devuelve datos correctos para un rango de 31 días

## 2. Wizard de agendamiento - Paso 1 (Selección)

- [x] 2.1 Reescribir `AgendarWizard` en `web/src/modules/appointments/components/agendar-wizard.tsx` como state machine con `step: 'select' | 'confirm'` y `selection: { specialtyId?, doctorId, date, scheduleId }`; verificar que compila y renderiza sin errores
- [x] 2.2 Implementar sección de filtros: `Select` especialidad (`useEspecialidades`) + `Input` búsqueda doctor (filtro client-side sobre `useDoctores`); verificar filtrado combinado AND funciona en tiempo real
- [x] 2.3 Implementar grid de `DoctorCard` usando `filteredDoctors` y `useAvailability` para próximo slot; al click en card → set `selection.doctorId` y habilita calendario; verificar selección visual (aria-pressed) y estado disabled cuando sin disponibilidad
- [x] 2.4 Integrar `MonthCalendar` below filters; `availabilityByDate` desde `useAvailabilityByDateRange` (mes actual); al seleccionar fecha → set `selection.date` y muestra panel de horarios; verificar que días sin disponibilidad no son seleccionables
- [x] 2.5 Implementar panel de horarios para fecha seleccionada: lista de `AvailabilitySlot` con `available > 0` como botones; al click → set `selection.scheduleId`; verificar que solo horarios con cupo son seleccionables
- [x] 2.6 Botón "Continuar" / "Revisar y confirmar" habilitado solo cuando `selection.doctorId && selection.date && selection.scheduleId`; click → `setStep('confirm')`; verificar validación y transición

## 3. Wizard de agendamiento - Paso 2 (Confirmación)

- [x] 3.1 Implementar `Dialog` de confirmación que se abre cuando `step === 'confirm'`; contenido: resumen formateado con doctor, especialidad, fecha (locale es-HN), hora inicio/fin, cupos; verificar rendering correcto
- [x] 3.2 Botón "Volver" en DialogFooter → `setStep('select')` preservando `selection`; verificar navegación bidireccional sin pérdida de datos
- [x] 3.3 Botón "Confirmar Cita" → llama `useBookAppointment.mutateAsync({scheduleId, date})`; en éxito: toast/alerta éxito con posición, `setStep('select')` reset selection, `queryClient.invalidateQueries(['appointments'])`; en error: muestra error en Dialog; verificar flujo completo crea cita y aparece en "Mis Citas"
- [x] 3.4 Manejo de concurrencia: si `mutateAsync` falla con "Horario completo" → cierra Dialog, muestra error inline en paso 1, refetch availability; verificar que usuario puede reintentar con disponibilidad actualizada

## 4. Integración y layout responsivo

- [x] 4.1 Actualizar `web/src/app/(app)/citas/agendar/page.tsx` para usar nuevo `AgendarWizard` (ya lo usa, solo verificar que imports correctos); verificar página carga sin errores
- [x] 4.2 Estilos responsivos: grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` para doctor cards; calendar + horarios panel lado a lado en `lg:` (`grid-cols-1 lg:grid-cols-2`); wizard pasos colapsados en móvil; verificar en Chrome DevTools device toolbar (375px, 768px, 1440px)
- [x] 4.3 Accesibilidad: añadir `role="grid"` `aria-label` a calendario, `aria-selected` día activo, `aria-label` disponibilidad; doctor cards como `<button>` con `aria-pressed`, `aria-disabled`; foco visible en todos controles (Tab/Shift+Tab); verificar con axe-core y navegación solo teclado

## 5. Testing y validación

- [x] 5.1 Añadir tests unitarios para `DoctorCard` (render, select, disabled state) y `MonthCalendar` (navegación, selección, indicadores) en `*.test.tsx`; verificar `npm test` pasa
- [x] 5.2 Añadir test de integración para `AgendarWizard` flujo completo (mock `useAvailability`, `useBookAppointment`); verificar pasos 1→2→confirm crea cita
- [x] 5.3 Test E2E con Playwright: paciente agenda cita completa (especialidad → doctor → fecha → horario → confirmar → ve en Mis Citas); verificar en CI

## 6. Limpieza y documentación

- [x] 6.1 Eliminar código muerto del `AgendarWizard` original (ya reemplazado inline); verificar no hay imports huérfanos
- [x] 6.2 Actualizar `openspec/specs/appointments/booking/spec.md` principal con los cambios del delta spec (merge manual post-archive); verificar `openspec validate` pasa

## 7. UI Design System (ui-skills)

- [x] 7.1 Ejecutar `baseline-ui` skill: revisar spacing, hierarchy, typography, layout en `DoctorCard`, `MonthCalendar`, `AgendarWizard`; aplicar fixes de baseline (spacing scale, type scale, visual hierarchy); verificar visual consistency con design tokens
- [x] 7.2 Ejecutar `improve-ui` skill: auditar nuevos componentes contra design evidence existente; identificar UI problems verificados; generar implementation plans para cada issue; verificar zero design-system drift
- [x] 7.3 Ejecutar `fixing-accessibility` skill: auditar ARIA labels, keyboard navigation, focus management, color contrast, form errors en wizard completo; fixear violations WCAG 2.2 AA; verificar con axe-core + manual keyboard testing
- [x] 7.4 Ejecutar `fixing-motion-performance` skill: revisar animaciones/transiciones en calendar navigation, card hover, dialog open/close; eliminar layout thrashing, usar compositor properties (transform/opacity), reducir blur effects; verificar 60fps en Chrome DevTools Performance

## 8. SEO Optimization (marketingskills)

- [x] 8.1 Ejecutar `fixing-metadata` skill en `web/src/app/(app)/citas/agendar/page.tsx`: page title optimizado ("Agendar Cita Médica | mediCitas"), meta description (<160 chars), canonical URL, Open Graph tags (og:title, og:description, og:image, og:type=website), Twitter cards, favicons, JSON-LD structured data, robots directives; verificar con Facebook Sharing Debugger + Twitter Card Validator
- [x] 8.2 Ejecutar `seo-audit` skill: technical SEO audit de `/citas/agendar` (crawlability, indexability, page speed, core web vitals, mobile usability); documentar issues y fixes; verificar Lighthouse SEO score >90
- [x] 8.3 Ejecutar `schema` skill: agregar JSON-LD structured data: `MedicalBusiness` (organization), `Physician` (doctors), `MedicalProcedure` (consultation), `Appointment` (booking action), `Schedule` (availability); validar con Google Rich Results Test + Schema.org Validator
- [x] 8.4 Ejecutar `ai-seo` skill: crear `llms.txt` y `llms-full.txt` en `public/`, optimizar contenido para AI citations (clear headings, structured data, FAQ), agregar OKF knowledge bundle; verificar visibilidad en Perplexity/ChatGPT/Claude para queries "agendar cita medica online"

## 9. QA Testing Strategy (qa-skills)

- [x] 9.1 Ejecutar `test-planning` skill: crear sprint test plan para agendamiento feature (feature decomposition, coverage mapping, effort estimation, prioritization matrix, resource allocation); documentar en `test-plan-appointments.md`
- [x] 9.2 Ejecutar `test-reliability` skill: configurar flaky test healing (multi-attribute selector healing, environment-aware diagnosis, quarantine management); aplicar a tests nuevos E2E; verificar flakiness rate <2%
- [x] 9.3 Ejecutar `accessibility-testing` skill: axe-core + Playwright automated WCAG 2.2 AA tests; keyboard navigation audit (Tab, Arrow keys, Escape, Enter); screen reader testing (NVDA/JAWS/VoiceOver); ARIA pattern validation; verificar 0 violations critical/high
- [x] 9.4 Ejecutar `visual-testing` skill: Playwright screenshot tests para `AgendarWizard` (paso 1, paso 2, estados: loading, error, success, empty); configurar Chromatic/Percy/Argos CI; baseline management; visual review workflow; verificar no visual regressions en PR

## 10. Security Testing (Anthropic-Cybersecurity-Skills)

- [x] 10.1 Ejecutar `integrating-dast-with-owasp-zap-in-pipeline` skill: configurar OWASP ZAP en GitHub Actions (baseline scan en PR, full scan nightly); scan contra `https://web-alpha-ecru-99.vercel.app/citas/agendar` y API `https://medicitas-api.onrender.com`; quality gates: 0 high/critical findings; documentar findings en security-report.md
- [x] 10.2 Ejecutar `testing-api-security-with-owasp-top-10` skill: API security testing contra OWASP API Top 10 2023 (Broken Object Level Auth, Broken Auth, Broken Object Property Level Auth, Unrestricted Resource Consumption, Broken Function Level Auth, Unrestricted Access to Sensitive Business Flows, Server Side Request Forgery, Security Misconfiguration, Improper Inventory Management, Unsafe Consumption of APIs); usar Burp Suite + Postman collections; verificar endpoints `/schedules/availability`, `/appointments`
- [x] 10.3 Ejecutar `testing-for-xss-vulnerabilities` skill: XSS testing (reflected, stored, DOM-based) en wizard inputs (búsqueda doctor, observaciones, campos de formulario); inyectar payloads JavaScript con Burp Suite (XSS extensions, Active Scan++); bypass sanitization/CSP; demostrar session hijacking/impersonation; verificar 0 exploitable XSS

## 11. Deployment (Vercel + Render + GitHub Actions)

- [x] 11.1 Crear `vercel.json` en `web/` con config: `buildCommand: "npm run build"`, `outputDirectory: ".next"`, `framework: "nextjs"`, `installCommand: "npm ci"`, `devCommand: "npm run dev"`, env vars reference; verificar `vercel build` local pasa
- [x] 11.2 Verificar `render.yaml` existente define `medicitas-api` service usando `Dockerfile` para deploy; agregar `autoDeploy: true` al service; confirmar backend deploy funciona en `https://medicitas-api.onrender.com`; **en caso de error en deploy en Render, preguntar al usuario sobre opciones para arreglar el problema (sin eliminar el deploy en Render del Dockerfile ni quitar la estructura de deploy en render ya existente)**
- [x] 11.3 Crear `.github/workflows/deploy.yml` con 2 jobs paralelos:
  - `deploy-backend`: trigger on push main, uses Render Deploy Hook o `render.yaml` sync, wait for health check `https://medicitas-api.onrender.com/health`
  - `deploy-frontend`: trigger on push main, uses `amondnet/vercel-action@v25`, `vercel-token: ${{ secrets.VERCEL_TOKEN }}`, `vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}`, `vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}`, `vercel-args: '--prod'`, alias `web-alpha-ecru-99.vercel.app`
- [x] 11.4 Configurar secrets en GitHub: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `RENDER_DEPLOY_HOOK` (o `RENDER_API_KEY`); verificar workflow ejecuta sin errores en push de prueba
- [x] 11.5 Validar deployment end-to-end: push a main → GitHub Actions verde → frontend live en `https://web-alpha-ecru-99.vercel.app/citas/agendar` → backend live en `https://medicitas-api.onrender.com` → test flujo completo agendamiento en producción