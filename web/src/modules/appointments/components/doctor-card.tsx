"use client"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ScheduleItem } from "@/modules/schedules/queries"
import { bitmaskToDays, DIAS } from "@/modules/schedules/queries"

interface DoctorCardProps {
  doctor: { id: string; fullName: string; specialties?: string[] }
  specialtyName?: string
  schedules?: ScheduleItem[]
  availabilitySummary?: {
    hasAvailabilityThisWeek: boolean
    hasAvailabilityThisMonth: boolean
    nextSlot?: { scheduleId: string; startTime: string; endTime: string; available: number; total: number } | null
  }
  selected?: boolean
  disabled?: boolean
  onSelect: (doctorId: string) => void
  onViewAgenda: (doctorId: string) => void
}

function formatDaysLabel(bitmask: number): string {
  const days = bitmaskToDays(bitmask)
  if (days.length === 0) return "Sin días"
  if (days.length === 7) return "Lun–Dom"

  let isConsecutive = true
  for (let i = 1; i < days.length; i++) {
    if (days[i] !== days[i - 1] + 1) {
      isConsecutive = false
      break
    }
  }

  const dayNames = days.map((d) => DIAS[d])
  if (isConsecutive) {
    return `${dayNames[0]}–${dayNames[dayNames.length - 1]}`
  }
  return dayNames.join(", ")
}

function formatScheduleSummary(schedules: ScheduleItem[]): string {
  const groups = new Map<number, ScheduleItem[]>()
  for (const s of schedules) {
    const key = s.daysBitmask
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(s)
  }

  return Array.from(groups.entries())
    .map(([bitmask, items]) => {
      const daysLabel = formatDaysLabel(bitmask)
      const times = items.map((i) => `${i.startTime.slice(0, 5)}–${i.endTime.slice(0, 5)}`).join(", ")
      return `${daysLabel} ${times}`
    })
    .join(" | ")
}

export function DoctorCard({
  doctor,
  specialtyName,
  schedules = [],
  availabilitySummary,
  selected = false,
  disabled = false,
  onSelect,
  onViewAgenda,
}: DoctorCardProps) {
  const hasAvailability = availabilitySummary?.hasAvailabilityThisMonth ?? false
  const nextSlot = availabilitySummary?.nextSlot
  const scheduleCount = schedules.length
  const nextAvailable = nextSlot ? `${nextSlot.available}/${nextSlot.total}` : "0"

  // Determine if card should be disabled
  const isDisabled = disabled || !hasAvailability

  return (
    <button
      type="button"
      onClick={() => !isDisabled && onSelect(doctor.id)}
      disabled={isDisabled}
      aria-pressed={selected}
      aria-disabled={isDisabled}
      aria-label={
        `${doctor.fullName}, ${specialtyName ?? doctor.specialties?.[0] ?? "Sin especialidad"}${hasAvailability ? `, ${scheduleCount} horarios, próximo: ${nextAvailable} cupos` : ", sin disponibilidad próximas 4 semanas"}`
      }
      data-testid={`doctor-card-${doctor.id}`}
      className={cn(
        "w-full text-left rounded-xl border p-4 transition-all outline-none",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        selected && "border-primary bg-primary/5 ring-1 ring-primary",
        !selected && !isDisabled && "hover:border-primary/50 hover:bg-accent/50",
        isDisabled && "bg-muted/30"
      )}
    >
      <Card className={cn(
        "p-0 border-0 shadow-none bg-transparent gap-3",
        selected && "text-primary"
      )}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">
              {doctor.fullName}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {specialtyName ?? doctor.specialties?.[0] ?? "Sin especialidad"}
            </p>
          </div>
          {selected && (
            <span className="shrink-0 size-5 rounded-full bg-primary flex items-center justify-center" aria-hidden="true">
              <svg className="size-3 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
          )}
        </div>
        <div className="border-t pt-2 space-y-1.5">
          {scheduleCount > 0 ? (
            <>
              <p className="text-xs text-muted-foreground line-clamp-1">
                {schedules.map((s) => formatDaysLabel(s.daysBitmask)).join(" | ")} 
                <span className="font-medium ml-1">{schedules[0]?.startTime.slice(0,5)}–{schedules[0]?.endTime.slice(0,5)}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-primary">{scheduleCount}</span> horario{scheduleCount !== 1 ? "s" : ""} ·{" "}
                <span className="font-medium text-primary">{nextAvailable}</span> cupos próximo
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground italic">Sin horarios configurados</p>
          )}
          <div className="border-t pt-2">
            <Button
              variant={isDisabled ? "outline" : "default"}
              size="sm"
              className="w-full"
              onClick={() => !isDisabled && onViewAgenda(doctor.id)}
              disabled={isDisabled}
            >
              {hasAvailability ? "Ver agenda" : "Sin disponibilidad"}
            </Button>
          </div>
        </div>
      </Card>
    </button>
  )
}