## Purpose

Define las reglas de validación y criterios de negocio para la creación de citas médicas, garantizando integridad de cupos, prevención de solapes, límites de equidad y manejo de concurrencia.

## ADDED Requirements

### Requirement: Control de concurrencia por cupo (Optimistic Lock)

El sistema SHALL prevenir overbooking cuando múltiples pacientes intentan reservar el último cupo de un horario simultáneamente, usando bloqueo optimista en la entidad Schedule.

#### Scenario: Dos pacientes confirman último cupo simultáneamente
- **WHEN** dos pacientes envían request de confirmación para el mismo `scheduleId` + `date` donde `booked = slotCapacity - 1`
- **THEN** la primera transacción lee `version = N`, valida `booked < slotCapacity`, incrementa `version` a `N+1` y crea la cita
- **AND** la segunda transacción intenta actualizar `version = N` pero encuentra `version = N+1` → falla con error `CONCURRENT_BOOKING`
- **AND** el frontend reintenta automáticamente (máx 3 veces con backoff 100/200/300ms) y obtiene error "Horario completo" en el retry

#### Scenario: Retry transparente resuelve contienda baja
- **WHEN** contienda de 2-3 requests simultáneos por mismo cupo
- **THEN** solo una cita se crea, las otras reciben error controlado y reintentan
- **AND** ningún request pierde la cita por error de sistema (todos terminan en éxito o "Horario completo" legítimo)

### Requirement: Prevención de solape de horarios (Overlap)

El sistema SHALL bloquear la creación de una cita si el paciente ya tiene otra cita confirmada que se solapa en hora el mismo día, aunque sea con diferente doctor o especialidad.

#### Scenario: Paciente intenta agendar cita que se solapa con existente
- **WHEN** paciente con cita confirmada `09:00-10:00` (schedule A) intenta agendar `09:30-10:30` (schedule B) misma fecha
- **THEN** sistema rechaza con error `OVERLAP_CONFLICT` "Ya tiene una cita que se solapa en ese horario"
- **AND** no se crea la nueva cita

#### Scenario: Citas contiguas sin solape permitidas
- **WHEN** paciente tiene cita `09:00-10:00` e intenta agendar `10:00-11:00` misma fecha
- **THEN** sistema permite la reserva (fin de primera = inicio de segunda = sin solape)

### Requirement: Ventana de antelación para agendamiento

El sistema SHALL rechazar reservas fuera de la ventana permitida: mínimo 2 horas de antelación, máximo 60 días de antelación.

#### Scenario: Intento agendar con menos de 2 horas de antelación
- **WHEN** paciente intenta agendar cita para `date = hoy` y `startTime` en menos de 2 horas
- **THEN** sistema rechaza con error `INVALID_ADVANCE` "No se puede agendar con menos de 2 horas de antelación"

#### Scenario: Intento agendar con más de 60 días de antelación
- **WHEN** paciente intenta agendar cita para fecha > 60 días en el futuro
- **THEN** sistema rechaza con error `INVALID_ADVANCE` "No se puede agendar con más de 60 días de antelación"

#### Scenario: Fecha exacta en límites permitida
- **WHEN** paciente agenda para dentro de exactamente 2 horas o exactamente 60 días
- **THEN** sistema permite la reserva

### Requirement: Límites de citas por paciente para equidad

El sistema SHALL limitar a 1 cita por día y 2 citas por semana (lunes-domingo) por paciente, con mecanismo de excepción administrada.

#### Scenario: Paciente intenta segunda cita mismo día
- **WHEN** paciente con cita confirmada hoy intenta agendar segunda cita hoy
- **THEN** sistema rechaza con error `DAILY_LIMIT_EXCEEDED` "Máximo 1 cita por día. Contacte a recepción para excepción"

#### Scenario: Paciente intenta tercera cita misma semana
- **WHEN** paciente con 2 citas confirmadas esta semana (lun-dom) intenta agendar tercera
- **THEN** sistema rechaza con error `WEEKLY_LIMIT_EXCEEDED` "Máximo 2 citas por semana. Contacte a recepción para excepción"

#### Scenario: Excepción administrativa permite exceder límite
- **WHEN** admin/recepción aprueba excepción para paciente
- **THEN** sistema permite crear la cita ignorando límites diarios/semanales
- **AND** registra auditoría: `patientId`, `adminId`, `reason`, `timestamp`, `limitType` (daily/weekly)

### Requirement: Validación de duplicado exacto

El sistema SHALL rechazar intento de crear cita duplicada (mismo paciente + mismo scheduleId + misma fecha).

#### Scenario: Doble click o reenvío formulario crea duplicado
- **WHEN** request duplicado llega a `/appointments` (mismo `patientId`, `scheduleId`, `date`)
- **THEN** constraint única BD rechaza o service valida y retorna error `DUPLICATE_APPOINTMENT` "Ya tiene una cita agendada para ese horario y fecha"

### Requirement: Cancelación libera cupo y respeta límites

El sistema SHALL liberar el cupo al cancelar y decrementar contadores de límites del paciente.

#### Scenario: Cancelación exitosa libera cupo inmediatamente
- **WHEN** paciente cancela cita confirmada
- **THEN** cita pasa a `CANCELLED`
- **AND** `booked` count para ese `scheduleId` + `date` decrementa
- **AND** cupo vuelve a estar disponible en `/availability` y calendario
- **AND** contadores daily/weekly del paciente decrementan

#### Scenario: Cancelación de cita ya cancelada rechazada
- **WHEN** intento cancelar cita con `status = CANCELLED`
- **THEN** sistema rechaza con error `ALREADY_CANCELLED` "Cita ya cancelada"