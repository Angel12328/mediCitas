## 1. Backend — Migración BD + Optimistic Lock

- [ ] 1.1 Crear migración Prisma `add_schedule_version` que añade `version Int @default(1)` a modelo `Schedule` — verificar `npx prisma migrate dev` exitoso y columna creada en BD
- [ ] 1.2 Actualizar `appointment.service.ts` función `createAppointment`: agregar validaciones (fecha en daysBitmask, cupo, optimistic lock, overlap, antelación 2h/60d, límites 1/día 2/sem, duplicado) — verificar tests unitarios pasan
- [ ] 1.3 Implementar retry logic en `appointment.service.ts` para `CONCURRENT_BOOKING` (máx 3 reintentos con backoff 100/200/300ms) — verificar test de concurrencia simula 2 requests simultáneos y solo una crea cita
- [ ] 1.4 Añadir códigos de error `AppError`: `CONCURRENT_BOOKING`, `OVERLAP_CONFLICT`, `INVALID_ADVANCE`, `DAILY_LIMIT_EXCEEDED`, `WEEKLY_LIMIT_EXCEEDED`, `DUPLICATE_APPOINTMENT` — verificar mapeo a HTTP status correctos
- [ ] 1.5 Ejecutar suite de tests backend (`npm run test`) — verificar 19/19 tests pasan (existentes + nuevos)

## 2. Backend — Endpoint /availability Batch

- [ ] 2.1 Extender `schedule.routes.ts` `GET /availability` para aceptar query params opcionales `scheduleId`, `startDate`, `endDate` — verificar response schema con Zod
- [ ] 2.2 Implementar lógica batch: si `scheduleId` + rango presentes → devolver array `[{ date, scheduleId, startTime, endTime, slotCapacity, booked, available }]` filtrado por `daysBitmask` y fechas futuras — verificar con curl manual
- [ ] 2.3 Incluir `daysBitmask` del schedule en response batch — verificar campo presente
- [ ] 2.4 Mantener compatibilidad: sin `scheduleId` + rango → comportamiento actual (requiere `date` única) — verificar tests existentes no rotan
- [ ] 2.5 Añadir test integración para batch response — verificar `npm run test` incluye nuevo test

## 3. Backend — Endpoint /doctors con Availability Summary

- [ ] 3.1 Extender `doctor.routes.ts` `GET /doctors` para aceptar `withAvailability`, `daysAhead`, `sort`, `filter` — verificar Zod schema
- [ ] 3.2 Implementar CTE SQL raw (`$queryRaw`) que calcula `availabilitySummary` por doctor: `hasAvailabilityThisWeek`, `hasAvailabilityThisMonth`, `nextAvailableDate`, `nextSlot`, `totalSlotsThisMonth`, `totalAvailableThisMonth` — verificar query plan usa índices
- [ ] 3.3 Implementar `sort=availability` (con cupo primero) y `filter=hasAvailabilityThisWeek` — verificar ordenamiento y filtrado server-side
- [ ] 3.4 Serializar `availabilitySummary` en response items — verificar tipo TypeScript `DoctorItem` extendido
- [ ] 3.5 Añadir test integración para summary correctness y sort/filter — verificar `npm run test`

## 4. Frontend — Hooks Nuevos y Actualizados

- [ ] 4.1 Crear `web/src/modules/appointments/hooks/use-doctor-schedules.ts` → `useDoctorSchedules(doctorId, specialtyId)` usa `GET /schedules?doctorId&specialtyId` — verificar hook retorna schedules tipados
- [ ] 4.2 Crear `web/src/modules/appointments/hooks/use-schedule-availability.ts` → `useScheduleAvailability(scheduleId, startDate, endDate)` usa batch `/availability` — verificar fetch on-demand al navegar mes
- [ ] 4.3 Actualizar `web/src/modules/schedules/queries.ts`: `useAvailability` mantiene compatibilidad fecha única; añadir `useDoctorSchedules` export — verificar types
- [ ] 4.4 Actualizar `web/src/modules/staff-admin/queries.ts` `useDoctores`: aceptar opciones `{ withAvailability?, daysAhead?, sort?, filter? }` — verificar query params se pasan correctamente
- [ ] 4.5 Actualizar `web/src/modules/appointments/hooks/use-book-appointment.ts`: añadir retry automático (3× backoff) para error `CONCURRENT_BOOKING` — verificar test mock simula conflicto y retry funciona
- [ ] 4.6 Eliminar `web/src/modules/appointments/hooks/use-availability-by-date-range.ts` — verificar no imports rotos

## 5. Frontend — Componentes ScheduleDialog

- [ ] 5.1 Crear `web/src/modules/appointments/components/schedule-dialog.tsx` — `ScheduleDialog` con estado `view: 'weekly' | 'datePicker'`, `selectedScheduleId`, `selectedDate`, header/footer sticky responsive — verificar render sin errores
- [ ] 5.2 Crear `web/src/modules/appointments/components/weekly-schedule-list.tsx` — `WeeklyScheduleList` agrupa schedules por `daysBitmask`, renderiza filas con ícono franja (☀/🌤/🌙), rango, cupos, botón `[Seleccionar]` / `[Completo]` — verificar agrupación correcta
- [ ] 5.3 Crear `web/src/modules/appointments/components/date-picker-with-availability.tsx` — `DatePickerWithAvailability` usa `react-day-picker` (o grid custom) + lista vertical con radio buttons; fetch batch al navegar mes via `useScheduleAvailability` — verificar grid + lista sincronizados
- [ ] 5.4 Añadir íconos franja horaria: constante `TIME_SLOT_ICONS` mapea rango → ☀/🌤/🌙 — verificar visual correcto
- [ ] 5.5 Responsive: `DialogContent` con `className="max-w-full sm:max-w-lg"` + header/footer sticky en móvil — verificar en viewport <640px y ≥640px

## 6. Frontend — DoctorCard V2

- [ ] 6.1 Actualizar `web/src/modules/appointments/components/doctor-card.tsx`:
  - Nuevo prop `schedules?: ScheduleItem[]`
  - Función `formatScheduleSummary(schedules)` agrupa por `daysBitmask` → "Lun-Vie 08-12, 14-17 | Sáb 09-13"
  - Badge: `${schedules.length} horarios · ${nextSlot?.available ?? 0} cupos próximo`
  - Botón `[Ver agenda]` (primario) en lugar de selección directa
  - Estado disabled si `!schedules?.length` o `availabilitySummary.hasAvailabilityThisMonth=false`
- [ ] 6.2 Actualizar `AgendarWizard` para pasar `schedules` a `DoctorCard` (desde `useDoctores` con `withAvailability`) — verificar card muestra resumen correcto
- [ ] 6.3 Añadir test `doctor-card.test.tsx` para resumen semanal y estados disabled — verificar `npm run test` frontend

## 7. Frontend — Wizard Integration (AgendarWizard)

- [ ] 7.1 Reescribir `web/src/modules/appointments/components/agendar-wizard.tsx` flujo 3 pasos:
  - Paso 1: Especialidad + búsqueda doctor (usa `useDoctores` con `withAvailability=true`)
  - Checkbox "Con disponibilidad esta semana" → filtra local `hasAvailabilityThisWeek`
  - Paso 2: Click `[Ver agenda]` → abre `ScheduleDialog` con `doctorId`, `specialtyId`
  - `ScheduleDialog` `onSelect={({ scheduleId, date }) => setSelection({...})}` → cierra diálogo
  - Paso 3: `ConfirmDialog` con resumen + `useBookAppointment` retry
- [ ] 7.2 Eliminar imports y lógica de `MonthCalendar`, `useAvailabilityByDateRange`, panel horarios lateral — verificar no código muerto
- [ ] 7.3 Estado `selection` unificado: `{ specialtyId, doctorId, scheduleId, date }` — verificar transiciones correctas
- [ ] 7.4 Toast/feedback: éxito muestra posición, error muestra mensaje legible (mapeo códigos backend) — verificar UX

## 8. Limpieza y Tests

- [ ] 8.1 Eliminar `web/src/modules/appointments/components/month-calendar.tsx` y `month-calendar.test.tsx` — verificar no imports rotos (`grep -r "MonthCalendar"`)
- [ ] 8.2 Ejecutar `npm run lint` y `npm run format` en raíz y `web/` — verificar 0 errores
- [ ] 8.3 Ejecutar `npm run test` en raíz (backend) y `web/` (frontend) — verificar todas pasan
- [ ] 8.4 Build producción: `npm run build` (raíz) y `npm run build --prefix web` — verificar builds exitosos

## 9. Deploy y Validación

- [ ] 9.1 Commit + push a `main` → GitHub Actions deploya backend (Render) y frontend (Vercel) — verificar jobs success
- [ ] 9.2 Smoke test producción `https://web-self-eight-c3lnokun26.vercel.app/citas/agendar`:
  - Seleccionar especialidad → ver doctors con resumen semanal
  - Click `[Ver agenda]` → WeeklyScheduleList correcta
  - Click `[Seleccionar]` → DatePickerWithAvailability con grid + lista
  - Seleccionar fecha → ConfirmDialog → Confirmar → éxito con posición
  - Verificar "Horario completo" si agota cupo
- [ ] 9.3 Verificar checkbox "Con disponibilidad esta semana" filtra correctamente
- [ ] 9.4 Verificar límites: intentar 2da cita mismo día → error `DAILY_LIMIT_EXCEEDED`
- [ ] 9.5 Verificar overlap: agendar cita que se solapa → error `OVERLAP_CONFLICT`

## 10. Documentación y Cierre

- [ ] 10.1 Actualizar `AGENTS.md` si cambió algún comando o convención — verificar diff
- [ ] 10.2 Archivar change: `openspec archive-change rediseno-agendamiento-citas` — verificar archivado en `openspec/changes/archive/`
- [ ] 10.3 Validar change archivado: `openspec validate` — verificar 0 errores