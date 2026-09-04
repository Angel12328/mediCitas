## Purpose

Define la interfaz de usuario completa para el agendamiento de citas médicas: visualización de doctores como cards, calendario interactivo mensual con indicadores de disponibilidad, filtros separados por especialidad y nombre de doctor, y wizard de dos pasos con resumen de confirmación antes de crear la cita.

## ADDED Requirements

### Requirement: Visualización de doctores como cards

El sistema SHALL mostrar los doctores disponibles como cards visuales en lugar de un dropdown, permitiendo al paciente escanear rápidamente opciones.

#### Scenario: Grid de doctor cards por especialidad seleccionada
- **WHEN** el paciente selecciona una especialidad en el filtro
- **THEN** el sistema muestra un grid responsivo de cards (1 columna en móvil, 2 en tablet, 3+ en desktop)
- **AND** cada card muestra: nombre completo del doctor, especialidad, y el próximo horario disponible con cupos libres

#### Scenario: Card muestra estado sin disponibilidad
- **WHEN** un doctor no tiene horarios con cupos libres para la fecha seleccionada
- **THEN** su card muestra indicador visual "Sin disponibilidad" y no es seleccionable
- **AND** el card permanece visible pero con estilo deshabilitado

### Requirement: Calendario interactivo mensual

El sistema SHALL proveer un calendario de vista mensual donde las fechas con disponibilidad tengan indicadores visuales, y al hacer click en una fecha se muestren las franjas horarias disponibles.

#### Scenario: Calendario muestra disponibilidad por día
- **WHEN** el calendario se renderiza para un mes dado
- **THEN** cada día que tiene al menos un horario con cupos libres muestra un indicador visual (punto/color)
- **AND** días sin disponibilidad no tienen indicador y lucen deshabilitados
- **AND** días pasados lucen deshabilitados

#### Scenario: Selección de fecha actualiza franjas horarias
- **WHEN** el paciente hace click en una fecha con disponibilidad
- **THEN** la fecha se marca como seleccionada visualmente
- **AND** el panel de franjas horarias se actualiza mostrando solo horarios para esa fecha
- **AND** si la fecha no tiene disponibilidad, no es seleccionable

#### Scenario: Navegación entre meses
- **WHEN** el paciente usa controles de mes anterior/siguiente
- **THEN** el calendario actualiza la vista y recalcula indicadores de disponibilidad para el nuevo mes

### Requirement: Filtros separados (especialidad + búsqueda doctor)

El sistema SHALL proveer dos controles de filtrado independientes: un dropdown de especialidades y un input de búsqueda por nombre de doctor.

#### Scenario: Filtrado por especialidad
- **WHEN** el paciente selecciona una especialidad en el dropdown
- **THEN** la lista de doctor cards se filtra mostrando solo doctores con esa especialidad activa
- **AND** el input de búsqueda por nombre se limpia

#### Scenario: Búsqueda por nombre de doctor
- **WHEN** el paciente escribe en el input de búsqueda
- **THEN** la lista de doctor cards se filtra en tiempo real coincidiendo con nombre completo
- **AND** el dropdown de especialidad se resetea a "Todas"

#### Scenario: Filtros combinados
- **WHEN** hay una especialidad seleccionada Y texto en búsqueda
- **THEN** se aplica filtro AND (doctor debe tener la especialidad Y coincidir con el nombre)

### Requirement: Wizard de dos pasos con resumen de confirmación

El sistema SHALL guiar al paciente en dos pasos: (1) selección de doctor, fecha y horario; (2) resumen y confirmación explícita antes de crear la cita.

#### Scenario: Paso 1 - Selección completa habilita siguiente paso
- **WHEN** el paciente ha seleccionado: especialidad (opcional), doctor, fecha, y un horario con cupo libre
- **THEN** el botón "Continuar" o "Revisar y confirmar" se habilita
- **AND** faltando cualquiera de estos, el botón permanece deshabilitado

#### Scenario: Paso 2 - Resumen de confirmación
- **WHEN** el paciente avanza al paso 2
- **THEN** se muestra un resumen con: nombre del doctor, especialidad, fecha formateada, hora de inicio y fin, y cupos disponibles
- **AND** botones: "Confirmar Cita" (primario) y "Volver" (secundario)

#### Scenario: Confirmación crea la cita
- **WHEN** el paciente hace click en "Confirmar Cita" en el paso 2
- **THEN** el sistema crea la cita vía API existente
- **AND** muestra estado de éxito con número de posición asignada
- **AND** redirige o actualiza la vista a "Mis Citas" con la nueva cita visible

#### Scenario: Volver al paso 1 preserva selección
- **WHEN** el paciente hace click en "Volver" desde el paso 2
- **THEN** regresa al paso 1 con todas las selecciones previas intactas

### Requirement: Diseño responsivo y accesible

El sistema SHALL renderizar correctamente en móviles, tablets y desktop, y cumplir WCAG 2.2 AA para navegación por teclado y lectores de pantalla.

#### Scenario: Layout móvil (≤640px)
- **WHEN** viewport ≤ 640px
- **THEN** doctor cards en una columna, calendario apilado verticalmente, wizard en pasos colapsados

#### Scenario: Layout tablet (641-1024px)
- **WHEN** viewport 641-1024px
- **THEN** doctor cards en 2 columnas, calendario y panel de horarios lado a lado si cabe

#### Scenario: Layout desktop (>1024px)
- **WHEN** viewport > 1024px
- **THEN** doctor cards en 3+ columnas, layout de 3 paneles (filtros, calendario, horarios/resumen)

#### Scenario: Navegación por teclado
- **WHEN** el usuario navega con Tab/Shift+Tab
- **THEN** todos los controles interactivos (filtros, cards, días calendario, botones) son alcanzables y operables
- **AND** foco visible en todo momento

#### Scenario: Lectores de pantalla
- **WHEN** un lector de pantalla recorre la interfaz
- **THEN** cards de doctores tienen role="button" o son <button> con aria-label descriptivo
- **AND** calendario usa role="grid" con aria-label por día
- **AND** estados (seleccionado, deshabilitado, con disponibilidad) anunciados vía aria-pressed/aria-disabled/aria-selected

### Requirement: SEO Metadata y Structured Data

El sistema SHALL incluir metadata SEO completa y structured data JSON-LD en la página de agendamiento para maximizar visibilidad orgánica y en AI search engines.

#### Scenario: Page metadata completa
- **WHEN** página `/citas/agendar` se renderiza server-side
- **THEN** `<title>` optimizado: "Agendar Cita Médica Online | mediCitas - Rápido y Seguro"
- **THEN** `<meta name="description">` <160 chars con keywords: "agendar cita médica", "doctor", "especialidad", "online"
- **THEN** `<link rel="canonical">` apunta a `https://web-alpha-ecru-99.vercel.app/citas/agendar`
- **THEN** Open Graph tags: `og:title`, `og:description`, `og:image` (og:image:width/height), `og:type=website`, `og:url`
- **THEN** Twitter Card tags: `twitter:card=summary_large_image`, `twitter:title`, `twitter:description`, `twitter:image`
- **THEN** Favicons: `favicon.ico`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`
- **THEN** `robots` meta: `index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1`

#### Scenario: JSON-LD Structured Data
- **WHEN** página se renderiza
- **THEN** incluye `@graph` con:
  - `MedicalBusiness` (organization: mediCitas, url, logo, sameAs, contactPoint, openingHoursSpecification)
  - `Physician` array (doctores disponibles: name, specialty, medicalSpecialty, availableService, location)
  - `MedicalProcedure` (consultation: name="Consulta Médica", description, medicalSpecialty)
  - `Schedule` (availability: byDay, openingHoursSpecification, validFrom/validThrough)
  - `WebPage` / `MedicalWebPage` (url, name, description, mainEntity)
- **THEN** validado con Google Rich Results Test + Schema.org Validator (0 errors)

#### Scenario: AI-SEO optimization
- **WHEN** sitio es crawlado por AI bots (GPTBot, ClaudeBot, PerplexityBot, etc.)
- **THEN** `llms.txt` en root describe sitio: "mediCitas - Plataforma de agendamiento de citas médicas online en Honduras"
- **THEN** `llms-full.txt` incluye contenido clave: flujo agendamiento, especialidades, doctores, FAQ
- **THEN** contenido estructurado con headings semánticos (h1-h3), listas, FAQ schema para AI citations
- **THEN** OKF (Open Knowledge Format) knowledge bundle disponible para agent consumption

### Requirement: Security-hardened UI

El sistema SHALL implementar controles de seguridad en la UI para prevenir XSS, CSRF, y exposición de datos sensibles.

#### Scenario: XSS prevention en inputs de usuario
- **WHEN** usuario ingresa datos en búsqueda doctor, observaciones, u otros campos de texto
- **THEN** React escapa automáticamente (JSX), pero validación adicional server-side
- **THEN** Content Security Policy header: `script-src 'self' 'nonce-...'`, `object-src 'none'`, `base-uri 'self'`
- **THEN** No inline scripts/estilos sin nonce

#### Scenario: CSRF protection en wizard
- **WHEN** usuario envía formulario de confirmación (Paso 2)
- **THEN** request incluye CSRF token en header `X-CSRF-Token` o cookie SameSite=Strict
- **THEN** backend valida token antes de crear cita

#### Scenario: No sensitive data en client state
- **WHEN** wizard mantiene `selection` state en memoria
- **THEN** no almacena PII (patient ID, medical info) en localStorage/sessionStorage
- **THEN** solo `doctorId`, `date`, `scheduleId`, `specialtyId` (referencias, no datos sensibles)

### Requirement: Deployment-ready frontend

El sistema SHALL ser deployable a Vercel con configuración óptima para Next.js App Router.

#### Scenario: Vercel configuration
- **WHEN** `vercel.json` presente en `web/`
- **THEN** `buildCommand: "npm run build"`, `outputDirectory: ".next"`, `framework: "nextjs"`
- **THEN** `installCommand: "npm ci"`, `devCommand: "npm run dev"`
- **THEN** Environment variables configuradas en Vercel Dashboard (no en repo)
- **THEN** `vercel build` local pasa sin errores

#### Scenario: GitHub Actions deploy
- **WHEN** push a `main`
- **THEN** workflow `.github/workflows/deploy.yml` ejecuta job `deploy-frontend`
- **THEN** usa `amondnet/vercel-action@v25` con secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
- **THEN** `vercel-args: '--prod'` para producción
- **THEN** alias automático a `web-alpha-ecru-99.vercel.app`
- **THEN** deployment visible en Vercel Dashboard + GitHub Actions summary

#### Scenario: Production validation
- **WHEN** deploy completa
- **THEN** `https://web-alpha-ecru-99.vercel.app/citas/agendar` carga <3s (LCP)
- **THEN** wizard funcional end-to-end en producción
- **THEN** APIs backend accesibles desde frontend producción (CORS configurado)