// Lógica de horarios: bitmask de días, solapamientos y disponibilidad
// Convención del bitmask (schema.prisma): bit 0 = lunes … bit 6 = domingo.

export const DAY_BITS = {
  LUNES: 1 << 0,
  MARTES: 1 << 1,
  MIERCOLES: 1 << 2,
  JUEVES: 1 << 3,
  VIERNES: 1 << 4,
  SABADO: 1 << 5,
  DOMINGO: 1 << 6,
} as const;

/** Bit correspondiente a un día JS getDay() (domingo=0 … sábado=6). */
export function dayBitFromJsDay(jsDay: number): number {
  return 1 << ((jsDay + 6) % 7);
}

/** Bitmask del día para una fecha 'YYYY-MM-DD' (interpretada en UTC). */
export function dayBitForDate(isoDate: string): number {
  const jsDay = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return dayBitFromJsDay(jsDay);
}

export function maskIncludesDay(mask: number, isoDate: string): boolean {
  return (mask & dayBitForDate(isoDate)) !== 0;
}

/** Intersección de días entre dos máscaras. */
export function daysOverlap(maskA: number, maskB: number): boolean {
  return (maskA & maskB) !== 0;
}

/**
 * ¿Se cruzan dos rangos horarios HH:mm?
 * Comparación lexicográfica válida por formato zero-padded.
 */
export function timesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && startB < endA;
}

export interface ScheduleLike {
  id: string;
  doctorId: string;
  specialtyId: string;
  daysBitmask: number;
  startTime: string;
  endTime: string;
  slotCapacity: number;
}

/**
 * Detecta conflicto de horarios: mismo doctor+especialidad, días que se
 * cruzan y rangos horarios que se superponen.
 * @param excludeScheduleId Horario a excluir (edición)
 */
export function findConflictingSchedule<T extends ScheduleLike>(
  candidate: Pick<
    ScheduleLike,
    'doctorId' | 'specialtyId' | 'daysBitmask' | 'startTime' | 'endTime'
  >,
  existing: T[],
  excludeScheduleId?: string,
): T | undefined {
  return existing.find(
    (schedule) =>
      schedule.id !== excludeScheduleId &&
      schedule.doctorId === candidate.doctorId &&
      schedule.specialtyId === candidate.specialtyId &&
      daysOverlap(schedule.daysBitmask, candidate.daysBitmask) &&
      timesOverlap(schedule.startTime, schedule.endTime, candidate.startTime, candidate.endTime),
  );
}
