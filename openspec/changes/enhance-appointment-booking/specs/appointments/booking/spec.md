## MODIFIED Requirements

### Requirement: Paciente busca horarios disponibles

El sistema SHALL permitir buscar horarios de atención filtrando por especialidad, doctor y/o fecha, con una interfaz que incluya cards visuales de doctores, calendario interactivo mensual, y filtros separados.

#### Scenario: Búsqueda por especialidad y fecha con cards de doctores
- **WHEN** paciente selecciona una especialidad en el dropdown de filtros
- **THEN** sistema muestra un grid de cards de doctores con esa especialidad activa
- **AND** cada card muestra: nombre del doctor, especialidad, y próximo horario disponible con cupos libres
- **AND** paciente puede seleccionar un doctor haciendo click en su card

#### Scenario: Búsqueda por doctor específico con búsqueda por nombre
- **WHEN** paciente escribe en el input de búsqueda por nombre de doctor
- **THEN** sistema filtra las cards en tiempo real coincidiendo con nombre completo
- **AND** dropdown de especialidad se resetea a "Todas"
- **WHEN** paciente selecciona un doctor de las cards filtradas y una fecha en el calendario
- **THEN** sistema devuelve solo los `HorarioAtencion` de ese doctor para la fecha dada

#### Scenario: Calendario interactivo muestra disponibilidad por día
- **WHEN** paciente navega el calendario mensual
- **THEN** días con al menos un horario con cupos libres muestran indicador visual
- **AND** días sin disponibilidad o pasados lucen deshabilitados
- **WHEN** paciente hace click en una fecha con disponibilidad
- **THEN** fecha se marca como seleccionada y panel de horarios se actualiza para esa fecha

### Requirement: Sistema valida disponibilidad de cupos

El sistema SHALL validar que existan cupos libres antes de confirmar una cita, tanto en el paso de selección como en la confirmación final.

#### Scenario: Cupo disponible en selección de horario
- **WHEN** paciente selecciona un horario con `cupos_ocupados < numeroCupos` para la fecha
- **THEN** sistema permite avanzar al paso de confirmación
- **AND** horario muestra cupos disponibles en la card/selector

#### Scenario: Sin cupos disponibles - horario no seleccionable
- **WHEN** un horario tiene `cupos_ocupados >= numeroCupos` para la fecha
- **THEN** horario se muestra como "Completo" y no es seleccionable en el paso 1
- **AND** doctor card muestra "Sin disponibilidad" si todos sus horarios están completos para esa fecha

### Requirement: Crear cita con posición asignada mediante wizard de 2 pasos

El sistema SHALL crear la cita con una posición única dentro del horario para esa fecha, tras confirmación explícita en un wizard de dos pasos.

#### Scenario: Paso 1 - Selección completa habilita paso 2
- **WHEN** paciente ha seleccionado: doctor, fecha, y un horario con cupo libre
- **THEN** botón "Continuar" o "Revisar y confirmar" se habilita
- **AND** faltando cualquiera, botón permanece deshabilitado

#### Scenario: Paso 2 - Resumen de confirmación antes de crear
- **WHEN** paciente avanza al paso 2
- **THEN** se muestra resumen con: nombre del doctor, especialidad, fecha formateada, hora inicio/fin, cupos disponibles
- **AND** botones: "Confirmar Cita" (primario) y "Volver" (secundario)

#### Scenario: Confirmación crea cita con posición atómica
- **WHEN** paciente hace click en "Confirmar Cita" en el paso 2
- **THEN** sistema crea la cita vía API (transacción atómica con SELECT FOR UPDATE)
- **AND** asigna `posicion = cupos_ocupados + 1`
- **AND** muestra estado de éxito con número de posición
- **AND** actualiza vista a "Mis Citas" con la nueva cita visible

#### Scenario: Concurrencia — dos pacientes al mismo tiempo
- **WHEN** dos pacientes confirman el último cupo simultáneamente en paso 2
- **THEN** solo una cita se crea (transacción atómica a nivel BD)
- **AND** el otro recibe error "Horario completo" y vuelve al paso 1 con disponibilidad actualizada

### Requirement: Validaciones de integridad en wizard

El sistema SHALL rechazar reservas que violen restricciones del modelo, validando en ambos pasos del wizard.

#### Scenario: Horario inactivo no seleccionable
- **WHEN** un `HorarioAtencion` tiene `estado = inactivo`
- **THEN** no aparece en cards de doctores ni en panel de horarios

#### Scenario: Paciente inexistente
- **WHEN** se intenta crear cita con `idPaciente` que no existe (sesión inválida)
- **THEN** sistema rechaza con error "Paciente no encontrado" y redirige a login

#### Scenario: Fecha pasada no seleccionable en calendario
- **WHEN** paciente navega a mes anterior o hace click en día anterior a hoy
- **THEN** días pasados lucen deshabilitados y no son seleccionables

### Requirement: Cancelar cita libera cupo

El sistema SHALL permitir cancelar citas y liberar el cupo correspondiente (sin cambios en esta funcionalidad, se mantiene especificación existente).

#### Scenario: Cancelación exitosa
- **WHEN** paciente cancela su cita confirmada desde "Mis Citas"
- **THEN** cita cambia a estado `cancelada`
- **AND** cupo queda disponible para nuevos pacientes en el calendario y cards

#### Scenario: Cancelación de cita ya cancelada
- **WHEN** se intenta cancelar una cita ya en estado `cancelada`
- **THEN** sistema rechaza con error "Cita ya cancelada"

### Requirement: Security validations en flujo de agendamiento

El sistema SHALL validar seguridad en el flujo de agendamiento protegiendo contra vulnerabilidades OWASP Top 10 y API Top 10.

#### Scenario: Rate limiting en búsqueda de disponibilidad
- **WHEN** paciente hace requests repetidos a `/schedules/availability` en ventana corta
- **THEN** sistema responde con HTTP 429 y header `Retry-After`
- **AND` no bloquea usuario legítimo (límite razonable: 30 req/min)

#### Scenario: Input sanitization en búsqueda de doctor
- **WHEN** paciente inyecta payload XSS en input búsqueda (ej. `<script>alert(1)</script>`)
- **THEN** sistema sanitiza input y no ejecuta script
- **AND** búsqueda trata payload como texto literal, no como HTML/JS

#### Scenario: Authorization check en creación de cita
- **WHEN** request a `/appointments` POST sin token válido o token de otro paciente
- **THEN** sistema rechaza con HTTP 401/403
- **AND** no crea cita ni filtra información de otros pacientes

#### Scenario: CSRF protection en wizard
- **WHEN** request POST a `/appointments` sin CSRF token válido (SameSite cookie + header)
- **THEN** sistema rechaza con HTTP 403
- **AND** wizard incluye CSRF token en form submission

### Requirement: Deployment readiness

El sistema SHALL ser deployable automáticamente a Vercel (frontend) y Render (backend) via GitHub Actions on push to main.

#### Scenario: Frontend deploy a Vercel
- **WHEN** push a branch `main` en GitHub
- **THEN** GitHub Actions ejecuta job `deploy-frontend` con Vercel CLI
- **THEN** build Next.js exitoso (`npm run build`)
- **THEN** deploy a `https://web-alpha-ecru-99.vercel.app` con alias de producción
- **THEN` página `/citas/agendar` accesible y funcional en producción

#### Scenario: Backend deploy a Render
- **WHEN** push a branch `main` en GitHub
- **THEN** GitHub Actions ejecuta job `deploy-backend` (Render Deploy Hook o render.yaml sync)
- **THEN** build backend exitoso usando `Dockerfile` (Render detecta y usa Dockerfile automáticamente)
- **THEN** servicio `medicitas-api` reiniciado en `https://medicitas-api.onrender.com` con `autoDeploy: true`
- **THEN** health check `/health` responde 200 OK
- **THEN** endpoints `/schedules/availability`, `/appointments` funcionales
- **WHEN** error en deploy en Render
- **THEN** notificar al usuario y consultar opciones de arreglo (sin eliminar Dockerfile ni estructura render.yaml)

#### Scenario: Deploy order y rollback
- **WHEN** ambos jobs completan exitosamente
- **THEN** deployment marcado como éxito en GitHub Actions
- **WHEN** fallback: frontend deploy falla
- **THEN** job `deploy-backend` ya completado no se revierte (idempotente)
- **WHEN** rollback manual: `git revert` + push → nuevo deploy automático