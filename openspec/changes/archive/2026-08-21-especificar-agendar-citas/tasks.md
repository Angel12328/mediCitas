## 1. Configuración y estructura

- [ ] 1.1 Definir estructura de módulos (repository, domain, use-cases) y verificar que los archivos esperados existen
- [ ] 1.2 Confirmar esquema real de tabla `Cita` (columnas ocultas) contra `modelo_relacional.mwb` y documentar hallazgos

## 2. Capa de datos (Repository)

- [ ] 2.1 Implementar `AppointmentRepository.findAvailableSlots(especialidadId?, doctorId?, fecha)` — query con JOINs y conteo de cupos; verificar con test de integración que devuelve horarios con `cuposLibres = numeroCupos - count(Cita)`
- [ ] 2.2 Implementar `AppointmentRepository.createCita(pacienteId, horarioId, fecha, posicion)` dentro de transacción con `SELECT FOR UPDATE`; verificar con test que bajo concurrencia solo una cita se crea para el último cupo
- [ ] 2.3 Implementar `AppointmentRepository.cancelCita(citaId)` y verificar que libera el cupo (nueva reserva posible)

## 3. Lógica de dominio (Value Objects / Services)

- [ ] 3.1 Implementar `AvailabilityChecker.check(horario, fecha, cuposOcupados)` — función pura que devuelve `posicion` o `null`; verificar con unit tests cubriendo: cupo disponible, horario lleno, horario inactivo, fecha pasada
- [ ] 3.2 Implementar `BookingService.reserve(pacienteId, horarioId, fecha)` orquestando repo + checker; verificar test de integración: éxito, sin cupos, paciente inexistente, horario inactivo

## 4. Validaciones de integridad

- [ ] 4.1 Agregar validación de `estado = 'activo'` en `HorarioAtencion` antes de reservar; verificar test rechaza horario inactivo
- [ ] 4.2 Agregar validación de existencia de `Paciente`; verificar test rechaza paciente inexistente
- [ ] 4.3 Agregar validación de fecha no pasada; verificar test rechaza fecha anterior a hoy

## 5. Verificación de integración

- [ ] 5.1 Test end-to-end: paciente busca por especialidad+fecha → ve horarios con cupos → reserva → cita creada con posicion correcta → cancela → cupo liberado → otro paciente reserva el mismo slot
- [ ] 5.2 Test de concurrencia: simular 2+ reservas simultáneas al último cupo; verificar solo una tiene éxito