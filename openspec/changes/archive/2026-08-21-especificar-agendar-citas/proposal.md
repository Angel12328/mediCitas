## Why

El modelo relacional ya define las tablas para agendar citas (`Cita`, `HorarioAtencion`, `Paciente`, `Doctor`), pero **no hay especificación formal** del comportamiento: cómo se valida disponibilidad, cómo se asignan cupos, qué reglas de negocio aplican. Sin esto, cualquier implementación será inconsistente.

## What Changes

- Se crea la especificación formal de la capacidad "agendar citas"
- Se definen reglas de validación de disponibilidad y cupos
- Se establecen los escenarios de éxito y error para el flujo de reserva

## Capabilities

### New Capabilities
- `appointments/booking`: Flujo completo de reserva de citas médicas — paciente elige especialidad/doctor/horario/fecha, sistema valida cupos disponibles, crea la cita con posición asignada

## Impact

- `openspec/specs/appointments/booking/`: Nueva carpeta de especificación (a crear)
- Modelo relacional existente (`modelo_relacional.mwb`): No cambia, pero se documenta su uso