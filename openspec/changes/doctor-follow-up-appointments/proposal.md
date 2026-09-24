## Why

Los doctores necesitan agendar citas de control (seguimiento) para pacientes después de atenderlos, sin cancelar ni modificar la cita original completada. Actualmente, la agenda del doctor permite marcar citas como "Atendido" (COMPLETED) pero no ofrece forma de crear una nueva cita de control en otro día/horario, obligando al doctor a salir de su flujo de trabajo.

## What Changes

- **Nueva vista de agenda agrupada por horarios**: La página `/agenda` muestra bloques de horario (ej. 08:00–12:00, 14:00–18:00) con cupos y pacientes por posición, en vez de lista plana.
- **Acciones contextuales por estado**: Dropdown híbrido con acción principal visible (Confirmar/Atendido) y secundarias en menú (No asistió, Agendar control).
- **Flujo Confirmar → Atendido**: Citas `PENDING` → `CONFIRMED` (llegada paciente) → `COMPLETED` (fin consulta).
- **Modal "Nueva cita de control"**: Desde citas `COMPLETED`, doctor abre modal, elige fecha y horario de **la misma especialidad**, crea cita `PENDING` independiente. Cita original queda `COMPLETED` intacta.
- **Nuevo endpoint API**: `POST /api/v1/appointments/follow-up` para crear cita de seguimiento reutilizando validaciones de reserva (bitmask, cupo, solapamiento, ventana 2h–60d).
- **Filtrado por especialidad**: El modal solo muestra horarios de la especialidad de la cita original (ej. Cardiología → solo horarios de Cardiología del doctor).

## Capabilities

### New Capabilities

- `doctors/follow-up-appointments`: Capacidad del doctor para crear citas de control post-consulta desde su agenda, con filtrado por especialidad y preservación de cita original.
- `appointments/follow-up-creation`: Endpoint y lógica de negocio para crear citas de seguimiento independientes a partir de citas completadas, reutilizando validaciones de reserva existentes.

### Modified Capabilities

- `doctors/management`: Extiende listado de doctores con vista de agenda diaria agrupada por horarios (nueva representación de datos, no cambio en requisitos de gestión de perfiles).
- `appointments/management`: Añade transición `PENDING → CONFIRMED` iniciada por doctor (antes solo admin) y nuevo tipo de creación de cita (follow-up) que no cancela la original.

## Impact

**Backend (API):**
- `src/modules/doctors/doctor.routes.ts` – Nuevo endpoint `/me/agenda?date=` para agenda agrupada por horarios
- `src/modules/appointments/appointment.routes.ts` – Nuevo endpoint `POST /follow-up`
- `src/modules/appointments/appointment.service.ts` – Lógica `createFollowUp` reutilizando `bookAppointment`
- `src/modules/doctors/schedule.routes.ts` – `GET /availability` ya soporta `specialtyId` (sin cambios)

**Frontend (Web):**
- `web/src/modules/appointments/components/agenda-doctor.tsx` – Vista por horarios + dropdown híbrido
- `web/src/modules/appointments/components/follow-up-modal.tsx` – Nuevo componente modal
- `web/src/modules/appointments/queries.ts` – Hooks `useAgendaDoctor`, `useHorariosDisponibles`, `useCrearFollowUp`
- `web/src/modules/appointments/queries.ts` – `AppointmentDto` añade `specialtyId`

**Base de datos:**
- Sin cambios de esquema (usa modelos existentes `Appointment`, `Schedule`, `Patient`)

**Tests:**
- Unit tests para `createFollowUp` service
- E2E tests para flujo completo agenda → modal → creación cita control