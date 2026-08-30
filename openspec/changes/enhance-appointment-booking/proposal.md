## Why

El flujo actual de agendamiento (`AgendarWizard`) usa dropdowns básicos y una lista simple de horarios. Los pacientes necesitan una experiencia más visual e intuitiva: ver doctores como cards con su disponibilidad, un calendario interactivo que muestre qué días tienen cupos, y un proceso de confirmación en dos pasos con resumen claro antes de crear la cita.

## What Changes

- **Nueva UI de selección de doctor**: Reemplazar dropdown por grid de cards (nombre, especialidad, próximo horario disponible)
- **Calendario interactivo mensual**: Vista de mes con indicadores visuales de disponibilidad por día; click en fecha → muestra franjas horarias
- **Filtros separados**: Dropdown de especialidad + input de búsqueda por nombre de doctor
- **Wizard de 2 pasos**: Paso 1 (selección) → Paso 2 (resumen + confirmación) → Éxito
- **Resumen de confirmación**: Modal/dialog con fecha, hora, doctor, especialidad antes de crear la cita
- **Diseño responsivo y atractivo**: Mobile-first, usando componentes UI existentes (Card, Dialog, Calendar styles)
- **UI Design System**: Aplicar baseline-ui, improve-ui, fixing-accessibility, fixing-motion-performance (ui-skills)
- **SEO Optimization**: Metadata, Open Graph, JSON-LD schema, AI-SEO para página de agendamiento (marketingskills)
- **QA Testing Strategy**: Test planning, reliability, accessibility, visual regression (qa-skills)
- **Security Testing**: OWASP ZAP DAST, API security, XSS testing post-implementación (Anthropic-Cybersecurity-Skills)
- **Deployment**: Vercel (frontend auto-deploy) + Render (backend auto-deploy) con GitHub Actions

## Capabilities

### New Capabilities
- `web/appointments/booking-ui`: Nueva capacidad que cubre la interfaz completa de agendamiento mejorada (cards de doctores, calendario interactivo, wizard 2 pasos, resumen de confirmación)
- `web/ui-design-system`: Aplicar design system y baseline UI improvements usando ui-skills
- `web/seo-optimization`: SEO técnico, metadata, structured data, AI-SEO para página de agendamiento
- `qa/testing-strategy`: Estrategia de testing QA integrada (unit, integration, E2E, accessibility, visual)
- `security/appointment-booking`: Security testing post-implementation para flujo de agendamiento
- `infra/deployment`: Deployment automatizado Vercel (frontend) + Render (backend) via GitHub Actions

### Modified Capabilities
- `appointments/booking`: La spec existente en `openspec/specs/appointments/booking/spec.md` requiere actualización para reflejar los nuevos requisitos de UI/UX (flujo de 2 pasos, calendario, cards de doctores, filtros separados), security validations y deployment readiness

## Impact

**Código afectado:**
- `web/src/modules/appointments/components/agendar-wizard.tsx` - Reescritura completa
- `web/src/app/(app)/citas/agendar/page.tsx` - Actualizar para usar nuevo wizard
- `web/src/modules/appointments/queries.ts` - Posibles nuevos hooks para disponibilidad por fecha/doctor
- `web/src/modules/schedules/queries.ts` - Hooks existentes reutilizados
- `web/src/modules/staff-admin/queries.ts` - `useDoctores` reutilizado
- `web/src/modules/catalogs/queries.ts` - `useEspecialidades` reutilizado
- `web/src/app/(app)/citas/agendar/page.tsx` - Metadata SEO, Open Graph, JSON-LD
- `.github/workflows/deploy.yml` - GitHub Actions para Vercel + Render deploy
- `vercel.json` - Configuración Vercel
- `render.yaml` - Configuración Render (ya existe, usa `Dockerfile` para deploy, agregar `autoDeploy: true`)

**Componentes UI existentes a reutilizar:**
- `Card`, `CardHeader`, `CardContent`, `CardFooter` (doctor cards)
- `Dialog`, `DialogHeader`, `DialogContent`, `DialogFooter` (resumen confirmación)
- `Button`, `Input`, `Label` (controles de filtro)
- Estilos Tailwind/globals.css (tema teal médico)

**Nuevas dependencias/skills:**
- `@ibelick/ui-skills` - baseline-ui, improve-ui, fixing-accessibility, fixing-motion-performance
- `@coreyhaines31/marketingskills` - product-marketing, seo-audit, schema, ai-seo
- `@petrkindlmann/qa-skills` - test-planning, test-reliability, accessibility-testing, visual-testing
- `@mukul975/Anthropic-Cybersecurity-Skills` - OWASP ZAP, API security testing, XSS testing

**APIs/Backend:** Sin cambios funcionales - usa endpoints existentes (`/schedules/availability`, `/appointments`). Solo deployment config en Render.