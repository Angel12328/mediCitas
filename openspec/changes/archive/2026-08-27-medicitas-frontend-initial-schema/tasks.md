# Tareas: Esquema inicial del frontend mediCitas

> **Regla de QA**: toda verificación de tarea se ejecuta con las skills de `petrkindlmann/qa-skills` activas, según el mapeo por grupo indicado en cada encabezado. Cada grupo cierra con su tarea de verificación QA documentada.
>
> **Skills complementarias**: la implementación visual usa `ibelick/ui-skills` (tokens, componentes, motion, estados); el SEO de rutas públicas usa `coreyhaines31/marketingskills` (product-marketing como contexto base, seo-audit/ai-seo/site-architecture/schema).

> **Plan de ejecución por fases (2 grupos por sesión)**: cuando el usuario diga "ejecuta" (sin más detalle), implementar ÚNICAMENTE la fase pendiente más antigua según esta tabla, marcar sus checkboxes al completarlas, resumir resultados y DETENERSE esperando confirmación. No avanzar a la fase siguiente sin instrucción explícita. Antes de empezar, releer este archivo para respetar el estado real de las casillas.

| Fase | Grupos | Alcance | Checkpoint de cierre |
|---|---|---|---|
| **F1** | 0 – 1 | Skills QA + `.agents/qa-project-context.md`; andamiaje Next.js/Tailwind/Vitest/proxy | `npm run dev` y pruebas de humo en verde |
| **F2** | 2 – 3 | Cliente API tipado, sesión JWT y auth UI; shell con navegación por los 4 roles | Login real contra backend local con los cuatro roles |
| **F3** | 4 – 5 | Catálogos compartidos; autoregistro de pacientes | Registro E2E local crea un paciente que puede iniciar sesión |
| **F4** | 6 – 7 | Perfil propio; consola administrativa (usuarios/empleados/doctores) | ADMIN gestiona cuentas y doctores desde la UI |
| **F5** | 8 – 9 | Horarios de atención; flujo completo de citas por rol | Ciclo agendar → atender/cancelar funciona localmente |
| **F6** | 10 – 11 | Integración docker-compose, SEO técnico y pulido UI; test de seguridad integral | `security-report.md` emitido sin críticos abiertos; auditoría seo-audit superada |
| **F7** | 12 | Push a GitHub; Render + Supabase + Vercel | Pipeline push→deploy verificado con login en producción |

## 0. Preparación de herramientas de QA (Foundation)

- [x] 0.1 Instalar skills QA (`npx skills add petrkindlmann/qa-skills`) y verificar que quedan disponibles para el agente
- [x] 0.2 Crear `.agents/qa-project-context.md` con stack, frameworks de prueba y entornos usando la skill `qa-project-context`; verificar que otras skills lo leen sin preguntas de discovery
- [x] 0.3 Instalar skills de diseño (`npx skills add ibelick/ui-skills`) y verificar acceso al catálogo por categorías (motion, componentes, estados)
- [x] 0.4 Instalar skills de marketing/SEO (`npx skills add coreyhaines31/marketingskills`) y crear `.agents/product-marketing.md` con la skill `product-marketing` describiendo mediCitas (producto, audiencia, posicionamiento)

## 1. Andamiaje de la aplicación — skills: `test-environments`, `unit-testing`, `ui-skills`

- [x] 1.1 Crear `web/` con Next.js 15 (App Router, TypeScript, ESLint+Prettier alineados al repo) y verificar `npm run dev` sirve la página inicial
- [x] 1.2 Configurar Tailwind CSS v4 + shadcn/ui y definir tokens base (color, espaciado, tipografía) consultando `ui-skills`; verificar que un botón de prueba renderiza con estilos
- [x] 1.3 Configurar Vitest + Testing Library en `web/` y verificar que `npm test` corre una prueba de humo
- [x] 1.4 Configurar rewrites/proxy `/api/v1/*` → backend en `next.config.ts` y verificar una llamada a `/api/v1/...` desde la web en desarrollo
- [x] 1.5 Verificación QA del grupo con `test-environments`: paridad de entornos local/docker documentada en `.agents/qa-project-context.md`

## 2. Cliente API tipado y sesión (web/auth, base transversal) — skills: `unit-testing`, `api-testing`, `service-virtualization`

- [x] 2.1 Añadir script `api:schema` que genera tipos desde `/docs/json` con openapi-typescript; verificar que `schema.d.ts` se genera y el typecheck pasa
- [x] 2.2 Implementar wrapper de fetch tipado (base URL, cookies server-side, mapeo de códigos de error a mensajes) con pruebas unitarias del mapeo
- [x] 2.3 Implementar Route Handler de sesión (login → cookies httpOnly access/refresh, logout → limpieza) y probar con vitest supertest-style contra el handler
- [x] 2.4 Implementar renovación transparente 401→refresh→reintento único→logout y cubrir ambos caminos con pruebas
- [x] 2.5 Implementar pantallas de login y recuperación/restablecimiento de contraseña según specs/web/auth/spec.md y verificar escenarios con Testing Library
- [x] 2.6 Verificación QA del grupo con `api-testing` + `service-virtualization` (MSW): contratos de auth cubiertos, mocks sin deriva respecto al OpenAPI real

## 3. Shell y navegación por rol (web/shell) — skill: `unit-testing`

- [x] 3.1 Definir layout raíz con rutas públicas `(auth)` y privadas `(app)` + protección middleware; verificar redirects visitante↔autenticado
- [x] 3.2 Implementar contexto de sesión/perfil (usuario, roles activos) alimentado desde cookie/perfil; verificar hidratación correcta
- [x] 3.3 Implementar navegación diferenciada PACIENTE/MÉDICO/ADMIN/SERVC y página 403; verificar los cuatro perfiles con seed local
- [x] 3.4 Probar flujo completo login → redirección por rol → logout con pruebas E2E-ligeras (Testing Library sobre páginas)
- [x] 3.5 Verificación QA del grupo con `unit-testing`: cobertura de guardas de ruta y navegación por rol

## 4. Catálogos compartidos (web/catalogs) — skills: `unit-testing`, `accessibility-testing`

- [x] 4.1 Implementar hooks TanStack Query para países/departamentos/municipios, especialidades, extensiones y cargos con staleTime largo; verificar reutilización sin refetch
- [x] 4.2 Implementar componente de selector jerárquico país→departamento→municipio con carga dependiente; verificar con pruebas de interacción
- [x] 4.3 Verificación QA del grupo con `unit-testing` + `accessibility-testing` (axe-core): selectores accesibles por teclado y etiquetas correctas

## 5. Autoregistro de pacientes (web/patient-onboarding) — skill: `ai-test-generation`

- [x] 5.1 Definir esquema zod del registro (persona, ubicación, credenciales, teléfono opcional) espejando auth.schemas.ts; verificar validaciones con pruebas
- [x] 5.2 Implementar formulario multi-sección con errores por campo y estados de éxito/error; verificar escenarios correo/DNI duplicado con mock del API
- [x] 5.3 Verificación QA del grupo con `ai-test-generation`: matriz de casos generada desde specs/web/patient-onboarding/spec.md y casos críticos automatizados

## 6. Perfil (web/profiles) — skill: `unit-testing`

- [x] 6.1 Implementar vista de perfil propio (datos personales solo lectura para DNI/fecha nacimiento, dirección, teléfonos); verificar renderizado para paciente vs empleado
- [x] 6.2 Implementar edición de datos personales y gestión de teléfonos (agregar/quitar con extensión); verificar persistencia vía mock API
- [x] 6.3 Implementar sección de datos clínicos exclusiva del PACIENTE (tipo sangre, alergias, contacto emergencia) con validación de tipo de sangre; verificar visibilidad por rol
- [x] 6.4 Verificación QA del grupo con `unit-testing`: visibilidad por rol y validaciones de campos clínicos

## 7. Consola administrativa (web/staff-admin) — skills: `unit-testing`, `accessibility-testing`

- [x] 7.1 Implementar listado paginado de usuarios con búsqueda y filtros rol/estado reutilizando el contrato de paginación del backend; verificar filtros combinados
- [x] 7.2 Implementar alta manual de cuentas con roles múltiples y manejo de duplicados; verificar escenarios del spec
- [x] 7.3 Implementar activar/desactivar usuarios con confirmación; verificar cambio visible en listado
- [x] 7.4 Implementar CRUD de empleados + asignación de cargos con historial; verificar asignación registrada con fecha
- [x] 7.5 Implementar doctores desde empleados + asignación/retiro de especialidades; verificar aparición/desaparición en catálogo de doctores por especialidad
- [x] 7.6 Verificación QA del grupo con `unit-testing` + `accessibility-testing`: tablas paginadas operables y accesibles

## 8. Horarios (web/schedules) — skill: `unit-testing`

- [x] 8.1 Implementar listado filtrable de franjas por doctor/especialidad/estado; verificar filtros
- [x] 8.2 Implementar creación de franja (días multi-select 0-6, hora inicio < fin, cupos > 0, observación) con validaciones; verificar casos inválidos rechazados
- [x] 8.3 Implementar edición con regla de cupos ≥ reservas existentes y activar/desactivar; verificar rechazo al reducir bajo reservas
- [x] 8.4 Verificación QA del grupo con `unit-testing`: reglas de validación de franjas cubiertas

## 9. Citas (web/appointments) — skills: `ai-test-generation`, `unit-testing`, `visual-testing`

- [x] 9.1 Implementar flujo guiado especialidad → doctor → franjas disponibles con cupos por fecha; verificar secuencia completa con mock API
- [x] 9.2 Implementar confirmación de cita con manejo de "Horario completo" (refresco de cupos y mensaje); verificar que no se crea cita
- [x] 9.3 Implementar "Mis citas" del paciente (próximas/histórico) con cancelación de futuras; verificar cupo liberado tras cancelar
- [x] 9.4 Implementar agenda diaria del MÉDICO ordenada por posición/hora con marcado ATEN/NA y aislamiento por médico; verificar marcado persistente
- [x] 9.5 Implementar gestión ADMIN/SERVC: listado con filtros fecha/estado/doctor/paciente, cancelación administrativa y edición de observación; verificar permisos por rol
- [x] 9.6 Verificación QA del grupo con `ai-test-generation` desde specs/web/appointments/spec.md + `visual-testing`: flujo de agendamiento estable visualmente

## 10. Integración y entrega — skills: `coverage-analysis`, `release-readiness`, `marketingskills`, `ui-skills`

- [x] 10.1 Ejecutar lint, typecheck y suite completa de pruebas de `web/` en verde
- [x] 10.2 Añadir servicio `web` a docker-compose.yml (build Next.js, env `API_URL`) y verificar `/health` del API consumido desde el contenedor web
- [x] 10.3 Recorrer manualmente los flujos críticos de cada rol contra el stack dockerizado y registrar hallazgos
- [x] 10.4 Verificación QA del grupo con `coverage-analysis` + `release-readiness`: cobertura ≥ umbral acordado y checklist go/no-go completada
- [x] 10.5 Implementar SEO técnico en rutas públicas con skills marketingskills: Metadata API (title/description/canonical), Open Graph/Twitter cards, `robots.txt`, `sitemap.xml` y JSON-LD `MedicalClinic` (skill `schema`); auditar con `seo-audit` y verificar metadatos en el build
- [x] 10.6 Pulido final de UI con `ui-skills`: consistencia de tokens, motion y estados (hover/focus/loading/error) en los 8 módulos; verificar revisión visual contra el playbook

## 11. Test de seguridad integral (posterior a la última tarea) — skills: `mukul975/Anthropic-Cybersecurity-Skills`

- [x] 11.1 Instalar skills de seguridad (`npx skills add mukul975/Anthropic-Cybersecurity-Skills`) y verificar disponibilidad de los dominios Web Application Security y API Security
- [x] 11.2 Evaluar OWASP Top 10 sobre la web Next.js (control de acceso roto por rol, gestión de sesión/cookies httpOnly, XSS, redirecciones) contra el stack dockerizado; registrar hallazgos con severidad
- [x] 11.3 Evaluar seguridad de la API expuesta al frontend (authN/authZ en endpoints, inyección, exposición excesiva de datos, rate limiting) con las skills de API Security; registrar hallazgos
- [x] 11.4 Remediar hallazgos críticos/high detectados y repetir las comprobaciones afectadas hasta aprobar; documentar los medios aceptados con justificación
- [x] 11.5 Emitir informe final de seguridad (alcance, metodología/skills usadas y versión, hallazgos, estado) en `docs/security-report.md` dentro de `web/` o raíz

## 12. Publicación y despliegue continuo (solo tras aprobar el test de seguridad)

- [x] 12.1 Inicializar git si no existe; revisar `.gitignore` para excluir `.env`, `node_modules`, `dist`, `tsconfig.tsbuildinfo` y artefactos generados; verificar con `git status --ignored`
- [x] 12.2 Escanear el árbol a commitear buscando secretos (claves JWT, credenciales) y confirmar que no hay valores reales antes del primer commit
- [x] 12.3 Crear `render.yaml` (Blueprint de Render): solo el web service del `Dockerfile` del API con healthcheck `/health`; `DATABASE_URL` y `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` declaradas como secretos a fijar en dashboard (`sync: false`); verificar sintaxis del blueprint
- [x] 12.4 Crear commit inicial con todo el código (incluido `render.yaml`) y hacer push a `https://github.com/Angel12328/mediCitas.git` (rama `main`); verificar que el remoto refleja el contenido y que no aparece ningún secreto
- [x] 12.5 Conectar el repositorio a Vercel: importar `Angel12328/mediCitas`, fijar Root Directory = `web/` y configurar variables de entorno para producción y preview (sin `API_URL` todavía); verificar que el primer build de producción termina en verde
- [x] 12.6 Crear proyecto Postgres en Supabase, obtener la cadena de conexión y ejecutar contra ella migraciones y seed (`prisma migrate deploy` + `npm run db:seed`); verificar tablas creadas y catálogos poblados
- [x] 12.7 Importar el repo en Render como Blueprint: crear el web service, fijar `DATABASE_URL` (Supabase) y los JWT secrets en el dashboard, confirmar `/health` en la URL HTTPS pública asignada y fijarla como `API_URL` en Vercel (producción y preview)
- [x] 12.8 Verificar pipeline completo push→deploy: un commit de prueba en `main` genera deployment del API en Render y de la web en Vercel; comprobar login real de un usuario sembrado contra producción (incluyendo cold start de ~30-60 s tras inactividad)
