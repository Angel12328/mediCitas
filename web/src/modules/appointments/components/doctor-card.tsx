"use client"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface DoctorCardProps {
  doctor: { id: string; fullName: string; specialties?: string[] }
  specialtyName?: string
  availabilitySummary?: {
    hasAvailabilityThisWeek: boolean
    hasAvailabilityThisMonth: boolean
    nextAvailableDate: string | null
    nextSlot?: { scheduleId: string; startTime: string; endTime: string; available: number; total: number } | null
    totalSlotsThisMonth: number
    totalAvailableThisMonth: number
  }
  selected?: boolean
  disabled?: boolean
  onSelect: (doctorId: string) => void
  onViewAgenda: (doctorId: string) => void
}

export function DoctorCard({
  doctor,
  specialtyName,
  availabilitySummary,
  selected = false,
  disabled = false,
  onSelect,
  onViewAgenda,
}: DoctorCardProps) {
  const hasAvailability = availabilitySummary?.hasAvailabilityThisMonth ?? false
  const nextSlot = availabilitySummary?.nextSlot

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
        `${doctor.fullName}, ${specialtyName ?? doctor.specialties?.[0] ?? "Sin especialidad"}${hasAvailability ? `, ${availabilitySummary?.totalSlotsThisMonth ?? 0} horarios, próximo: ${nextSlot ? `${nextSlot.available}/${nextSlot.total}` : "0"} cupos` : ", sin disponibilidad próximas 4 semanas"}`
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
          {availabilitySummary ? (
            <>
              {availabilitySummary.nextSlot ? (
                <p className="text-xs text-muted-foreground line-clamp-1">
                  Próximo: <span className="font-medium">{availabilitySummary.nextSlot.startTime.slice(0,5)}–{availabilitySummary.nextSlot.endTime.slice(0,5)}</span>
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-primary">{availabilitySummary.totalSlotsThisMonth}</span> horario{availabilitySummary.totalSlotsThisMonth !== 1 ? "s" : ""} ·{" "}
                <span className="font-medium text-primary">{availabilitySummary.nextSlot ? `${availabilitySummary.nextSlot.available}/${availabilitySummary.nextSlot.total}` : "0"}</span> cupos próximo
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