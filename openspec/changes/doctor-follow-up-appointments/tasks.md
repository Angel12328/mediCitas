## 1. Backend - DTO y Endpoint Agenda

- [x] 1.1 Añadir `specialtyId` a `AppointmentDto` en `src/modules/appointments/appointment.routes.ts` (función `toDto`) — verificar: `npm run build` compila sin errores
- [x] 1.2 Crear endpoint `GET /doctors/me/agenda?date=` en `src/modules/doctors/doctor.routes.ts` — verificar: `curl` con token DOCTOR devuelve horarios agrupados con cupos y appointments
- [x] 1.3 Añadir schema de validación `agendaQuerySchema` (date required, string.date) en `doctor.schemas.ts` — verificar: request sin date devuelve 400

## 2. Backend - Endpoint Follow-Up

- [x] 2.1 Crear `followUpSchema` en `src/modules/appointments/appointment.schemas.ts` (patientId, scheduleId, date, originalAppointmentId?) — verificar: Zod valida UUIDs y date
- [x] 2.2 Implementar `createFollowUp()` en `src/modules/appointments/appointment.service.ts` reutilizando `bookAppointment()` + validación originalAppointmentId COMPLETED — verificar: test unitario pasa
- [x] 2.3 Crear endpoint `POST /appointments/follow-up` en `src/modules/appointments/appointment.routes.ts` con guards DOCTOR/ADMIN — verificar: `curl` crea cita PENDING, original COMPLETED inalterada

## 3. Backend - Tests

- [x] 3.1 Test unitario: `createFollowUp` valida cita original COMPLETED — verificar: `npm run test` pasa test en `tests/modules/appointments/`
- [x] 3.2 Test unitario: `createFollowUp` rechaza si original no es COMPLETED — verificar: test pasa
- [x] 3.3 Test unitario: `createFollowUp` copia observación con prefijo "Control: " — verificar: test pasa
- [x] 3.4 Test E2E: Flujo completo agenda → modal → follow-up — verificar: `npm run test` pasa test en `tests/modules/appointments/appointment-module.test.ts`

## 4. Frontend - Types y Hooks

- [x] 4.1 Regenerar types OpenAPI: `npm run api:schema` + añadir manualmente `specialtyId` a `AppointmentDto` en `web/src/modules/appointments/queries.ts`
- [x] 4.2 Crear hook `useAgendaDoctor({ date })` en `web/src/modules/appointments/queries.ts` — verificar: TypeScript compila, devuelve `AgendaHorario[]`
- [x] 4.3 Crear hook `useHorariosDisponibles({ doctorId, specialtyId, date })` — verificar: usa `/schedules/availability` con specialtyId
- [x] 4.4 Crear hook `useCrearFollowUp()` con invalidación de queries — verificar: mutación devuelve nueva cita

## 5. Frontend - Componente Modal Follow-Up

- [x] 5.1 Crear `FollowUpModal.tsx` en `web/src/modules/appointments/components/` — verificar: renderiza sin errores, muestra paciente, especialidad, date picker, lista horarios con RadioGroup
- [x] 5.2 Integrar validación: fecha mínima mañana, máxima +60d — verificar: DatePicker bloquea fechas fuera de rango
- [x] 5.3 Mostrar mensaje si no hay horarios disponibles para fecha — verificar: UI muestra mensaje y deshabilita botón
- [x] 5.4 Botón "Agendar cita" llama `useCrearFollowUp` y cierra modal onSuccess — verificar: toast éxito, queries invalidadas

## 6. Frontend - Refactor AgendaDoctor

- [x] 6.1 Refactor `AgendaDoctor.tsx`: usar `useAgendaDoctor`, renderizar `HorarioCard` por schedule — verificar: UI muestra bloques 08-12, 14-18 con cupos X/Y
- [x] 6.2 `HorarioCard`: tabla posiciones 1..slotCapacity, filas vacías = "Cupo libre" — verificar: horario capacidad 3 con 1 cita muestra 2 filas "Cupo libre"
- [x] 6.3 Dropdown híbrido: botón principal según estado (Confirmar/Atendido/badge) + menú ▼ — verificar: PENDING muestra "Confirmar", CONFIRMED "Atendido", COMPLETED badge
- [x] 6.4 Menú ▼: No asistió + Agendar control (solo PENDING/CONFIRMED/COMPLETED) — verificar: click "Agendar control" abre `FollowUpModal` con datos cita
- [x] 6.5 Acciones de estado usan `useCambiarEstado` (ya existe) — verificar: Confirmar → CONFIRMED, Atendido → COMPLETED, No asistió → NO_SHOW

## 7. Frontend - Tests

- [x] 7.1 Test componente: `FollowUpModal` renderiza horarios filtrados por specialtyId — verificar: `npm run test` pasa
- [x] 7.2 Test componente: `AgendaDoctor` muestra horarios agrupados y dropdown correcto por estado — verificar: test pasa
- [x] 7.3 Test E2E Playwright: Flujo doctor agenda → atiende → agenda control — verificar: `npm run test:e2e` pasa

## 8. Integración y Verificación Final

- [x] 8.1 `npm run build` (API + Web) sin errores — verificar: `dist/` generado
- [x] 8.2 `npm run lint` en ambos paquetes — verificar: 0 errores
- [x] 8.3 `npm run test` (API) + `npm run test` (Web) + `npm run test:e2e` — verificar: todos pasan
- [x] 8.4 Prueba manual: Doctor logueado ve agenda, atiende paciente, agenda control en otra fecha — verificar: flujo completo funciona en dev