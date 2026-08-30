"use client"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface DoctorCardProps {
  doctor: { id: string; fullName: string; specialties?: string[] }
  specialtyName?: string
  nextSlot?: { startTime: string; endTime: string; available: number } | null
  selected?: boolean
  disabled?: boolean
  onSelect: (doctorId: string) => void
}

export function DoctorCard({
  doctor,
  specialtyName,
  nextSlot,
  selected = false,
  disabled = false,
  onSelect,
}: DoctorCardProps) {
  const hasAvailability = nextSlot != null && nextSlot.available > 0

  return (
    <button
      type="button"
      onClick={() => !disabled && onSelect(doctor.id)}
      disabled={disabled}
      aria-pressed={selected}
      aria-disabled={disabled || !hasAvailability}
      aria-label={`${doctor.fullName}, ${specialtyName ?? doctor.specialties?.[0] ?? "Sin especialidad"}${hasAvailability ? `, próximo horario: ${nextSlot.startTime}-${nextSlot.endTime}` : ", sin disponibilidad"}`}
      data-testid={`doctor-card-${doctor.id}`}
      className={cn(
        "w-full text-left rounded-xl border p-4 transition-all outline-none",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        selected && "border-primary bg-primary/5 ring-1 ring-primary",
        !selected && !disabled && "hover:border-primary/50 hover:bg-accent/50",
        disabled && "bg-muted/30"
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
        <div className="border-t pt-2">
          {hasAvailability ? (
            <p className="text-xs text-muted-foreground">
              <span className="text-primary font-medium">Próximo:</span>{" "}
              {nextSlot.startTime.slice(0, 5)}–{nextSlot.endTime.slice(0, 5)} ·{" "}
              <span className="text-primary font-medium">{nextSlot.available}</span> cupos
            </p>
          ) : (
            <p className="text-xs text-muted-foreground italic">Sin disponibilidad</p>
          )}
        </div>
      </Card>
    </button>
  )
}
