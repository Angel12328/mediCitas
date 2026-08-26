# Product Marketing Context

**Document version:** v1
**Last updated:** 2026-08-22

## Product Overview
**One-liner:** mediCitas — la forma simple de gestionar citas médicas entre pacientes y consultorios.
**What it does:** Permite a los pacientes agendar, consultar y cancelar citas por especialidad, doctor y horario disponible, y al personal (médicos, recepción, administración) gestionar agendas, horarios con cupos, pacientes y catálogos del consultorio.
**Product category:** Software de gestión de citas para salud (healthtech / scheduling).
**Product type:** Aplicación web transaccional multi-rol (Paciente, Médico, Admin, Servicio al Cliente) sobre API REST.
**Business model:** Proyecto de portafolio open source (sin monetización actual).

## Target Audience
**Target companies:** Consultorios médicos independientes, clínicas pequeñas y proyectos académicos de salud digital en países hispanohablantes (contexto geográfico país → departamento → municipio).
**Decision-makers:** Médico propietario o administrador del consultorio; coordinadores de recepción.
**Primary use case:** Publicar horarios de atención con cupos y dejar que el paciente reserve su turno sin llamadas telefónicas.
**Jobs to be done:**
- Como paciente: encontrar un doctor por especialidad y asegurar mi cupo sin llamar por teléfono.
- Como recepción/administración: llenar la agenda del día y registrar ausencias sin papel.
- Como administrador: dar de alta doctores, especialidades, cargos y horarios en minutos.

## Personas
| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| Paciente (Ana) | Reservar rápido y saber si hay cupo | Horarios de llamada limitados | Disponibilidad en tiempo real y confirmación inmediata |
| Médico (Dr. Rojas) | Ver su agenda del día y marcar asistencias | Llamadas constantes para reprogramar | Agenda ordenada por posición con estados claros |
| Admin/Recepción (Luisa) | Control total de citas y personal | Hojas de cálculo desactualizadas | Una sola fuente de verdad de cupos y personal |

## Problems & Pain Points
**Core problem:** La gestión de turnos médicos depende de teléfono y papel, generando ausencias, dobles reservas y colas.
**Why alternatives fall short:**
- Agendas genéricas (calendarios) no modelan cupos ni especialidades.
- El software clínico enterprise es costoso y complejo para consultorios pequeños.
**What it costs them:** Citas perdidas, recepción saturada y pacientes que desisten.
**Emotional tension:** El paciente teme quedarse sin atención; el personal teme perder el control de la agenda.

## Competitive Landscape
**Direct:** Sistemas de turnos comerciales — pago mensual y poco adaptables al modelo país/departamento/municipio.
**Secondary:** WhatsApp/teléfono — sin control de cupos ni historial.
**Indirect:** Papel/planilla — errores humanos y cero visibilidad para el paciente.

## Differentiation
**Key differentiators:**
- Cupos explícitos por franja de horario con asignación de posición.
- Flujo guiado Especialidad → Doctor → Horario.
- Cuatro roles con vistas dedicadas desde la primera versión.
- Localización hispana completa (incluida la jerarquía geográfica).
**How we do it differently:** Modelo de datos relacional pensado para salud (paciente, doctor, empleado/cargo, especialidad, horario) en lugar de un calendario genérico.
**Why that is better:** Refleja cómo opera realmente un consultorio.
**Why customers choose us:** Simplicidad, stack gratuito y transparencia open source.

## Objections
| Objection | Response |
|-----------|----------|
| ¿Es seguro para datos de salud? | Autenticación JWT con cookies httpOnly, contraseñas Argon2 y autorización por rol en cada endpoint. |
| ¿Y si se cae? | Infraestructura gestionada (Render + Supabase + Vercel) con despliegue automático por push. |
| ¿Necesito capacitación? | Flujos guiados paso a paso; el paciente reserva en tres pasos. |

**Anti-persona:** Hospitales grandes que requieren facturación, historia clínica electrónica completa o integración HL7/FHIR.

## Switching Dynamics
**Push:** Errores de agenda manual, dobles reservas y quejas de pacientes.
**Pull:** Ver la disponibilidad real de cupos desde el celular.
**Habit:** Llamar a recepción por cualquier cambio.
**Anxiety:** Desconfianza inicial en reservar sin hablar con una persona.

## Customer Language
**How they describe the problem:**
- "Nunca sé si hay cupo hasta que llamo."
- "La agenda se llena y nadie sabe quién tomó qué hora."
**How they describe us:**
- "Reservo como si fuera una función de cine."
**Words to use:** cita, cupo, horario, especialidad, doctor, agenda, turno.
**Words to avoid:** jerga clínica técnica, términos en inglés innecesarios.
**Glossary:**
| Term | Meaning |
|------|---------|
| Cupo | Espacio disponible dentro de una franja de HorarioAtencion |
| Posición | Número de orden de la cita dentro de la franja para esa fecha |
| PA/APUN/ATEN/NA | Estados de la cita: Por atender / Apuntado / Atendido / No asistió |

## Brand Voice
**Tone:** Cercano, claro y confiable.
**Style:** Español neutro, frases cortas, orientado a la acción.
**Personality:** Asistente de recepción amable y eficiente.

## Proof Points
**Metrics:** Reserva completa en tres pasos; renovación de sesión sin interrumpir al usuario.
**Customers:** Proyecto de portafolio; casos de uso demo con datos sembrados.
**Testimonials:** Pendientes (producto en fase inicial).
