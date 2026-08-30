"use client"
import { useState, useMemo, useCallback } from "react"
import { useEspecialidades } from "@/modules/catalogs/queries"
import { useDoctores, type DoctorItem } from "@/modules/staff-admin/queries"
import { useAvailability } from "@/modules/schedules/queries"
import type { AvailabilitySlot } from "@/modules/schedules/queries"
import { useBookAppointment } from "../queries"
import { useAvailabilityByDateRange } from "../hooks/use-availability-by-date-range"
import { DoctorCard } from "./doctor-card"
import { MonthCalendar } from "./month-calendar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type Step = "select" | "confirm"

interface Selection {
  specialtyId: string
  doctorId: string
  date: string
  scheduleId: string
}

interface DateRange {
  start: string
  end: string
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function monthRange(year: number, month: number): DateRange {
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0)
  return { start: toISODate(start), end: toISODate(end) }
}

function formatFecha(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("es-HN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function formatHora(time: string): string {
  return time.slice(0, 5)
}

export function AgendarWizard() {
  const [step, setStep] = useState<Step>("select")
  const [selection, setSelection] = useState<Selection>({
    specialtyId: "",
    doctorId: "",
    date: toISODate(new Date()),
    scheduleId: "",
  })
  const [doctorSearch, setDoctorSearch] = useState("")
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [calendarRange, setCalendarRange] = useState<DateRange>(() => {
    const now = new Date()
    return monthRange(now.getFullYear(), now.getMonth())
  })

  const especialidades = useEspecialidades()
  const doctores = useDoctores(selection.specialtyId || undefined)
  const availability = useAvailability(
    selection.doctorId || undefined,
    selection.specialtyId || undefined,
    selection.date || undefined
  )
  const book = useBookAppointment()

  const { availabilityByDate } = useAvailabilityByDateRange({
    specialtyId: selection.specialtyId || undefined,
    doctorId: selection.doctorId || undefined,
    startDate: calendarRange.start,
    endDate: calendarRange.end,
    enabled: Boolean(selection.specialtyId),
  })

  const filteredDoctors = useMemo(() => {
    const items = (doctores.data?.items ?? []) as DoctorItem[]
    if (!doctorSearch.trim()) return items
    const search = doctorSearch.toLowerCase()
    return items.filter((d) => d.fullName.toLowerCase().includes(search))
  }, [doctores.data?.items, doctorSearch])

  const doctorSlotsByDate = useMemo(() => {
    const map = new Map<string, AvailabilitySlot[]>()
    if (!selection.doctorId) return map
    availabilityByDate.forEach((slots, date) => {
      map.set(date, slots.filter((s) => s.available > 0))
    })
    return map
  }, [availabilityByDate, selection.doctorId])

  const selectedDoctor = useMemo(() => {
    if (!selection.doctorId) return null
    return filteredDoctors.find((d) => d.id === selection.doctorId) ?? null
  }, [filteredDoctors, selection.doctorId])

  const selectedSlot = useMemo(() => {
    if (!selection.scheduleId) return null
    return (availability.data?.items ?? []).find(
      (s: AvailabilitySlot) => s.scheduleId === selection.scheduleId
    ) ?? null
  }, [availability.data?.items, selection.scheduleId])

  const selectedSpecialtyName = useMemo(() => {
    return especialidades.data?.find((e) => e.id === selection.specialtyId)?.name ?? ""
  }, [especialidades.data, selection.specialtyId])

  const canContinue = Boolean(
    selection.doctorId && selection.date && selection.scheduleId
  )

  const handleSpecialtyChange = useCallback((id: string) => {
    setSelection((s) => ({ ...s, specialtyId: id, doctorId: "", scheduleId: "" }))
    setDoctorSearch("")
  }, [])

  const handleDoctorSelect = useCallback((doctorId: string) => {
    setSelection((s) => ({ ...s, doctorId, scheduleId: "" }))
  }, [])

  const handleDateSelect = useCallback((date: string) => {
    setSelection((s) => ({ ...s, date, scheduleId: "" }))
  }, [])

  const handleMonthChange = useCallback((year: number, month: number) => {
    setCalendarRange(monthRange(year, month))
  }, [])

  const handleSlotSelect = useCallback((scheduleId: string) => {
    setSelection((s) => ({ ...s, scheduleId }))
  }, [])

  const handleContinue = useCallback(() => {
    if (!canContinue) return
    setStep("confirm")
    setErr(null)
  }, [canContinue])

  const handleBack = useCallback(() => {
    setStep("select")
  }, [])

  const handleConfirm = useCallback(async () => {
    setErr(null)
    setMsg(null)
    try {
      const r = (await book.mutateAsync({
        scheduleId: selection.scheduleId,
        date: selection.date,
      })) as { position?: number }
      setMsg(`Cita creada · posición ${r.position ?? "?"}`)
      setStep("select")
      setSelection({
        specialtyId: selection.specialtyId,
        doctorId: "",
        date: selection.date,
        scheduleId: "",
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes("Horario completo") || msg.includes(" completo")) {
        setStep("select")
        setErr("Horario completo. Por favor selecciona otro horario.")
      } else {
        setErr(msg)
      }
    }
  }, [book, selection])

  const sel = "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

  return (
    <section className="grid gap-6" data-testid="agendar-wizard">
      {/* Step 1: Selection */}
      {step === "select" && (
        <div className="grid gap-6">
          {/* Filters */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ag-esp">Especialidad</Label>
              <select
                id="ag-esp"
                className={sel}
                value={selection.specialtyId}
                onChange={(e) => handleSpecialtyChange(e.target.value)}
              >
                <option value="">Todas las especialidades</option>
                {(especialidades.data ?? []).map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ag-doc-search">Buscar doctor</Label>
              <Input
                id="ag-doc-search"
                placeholder="Nombre del doctor..."
                value={doctorSearch}
                onChange={(e) => setDoctorSearch(e.target.value)}
                disabled={!selection.specialtyId}
              />
            </div>
          </div>

          {/* Doctor Cards Grid */}
          {selection.specialtyId && (
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                {filteredDoctors.length} doctor{filteredDoctors.length !== 1 ? "es" : ""} encontrado{filteredDoctors.length !== 1 ? "s" : ""}
              </p>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {filteredDoctors.map((doctor) => {
                  const daySlots = doctorSlotsByDate.get(selection.date) ?? []
                  const nextSlot = daySlots.find((s) => s.available > 0) ?? null
                  return (
                    <DoctorCard
                      key={doctor.id}
                      doctor={doctor}
                      specialtyName={selectedSpecialtyName}
                      nextSlot={nextSlot}
                      selected={doctor.id === selection.doctorId}
                      disabled={!nextSlot}
                      onSelect={handleDoctorSelect}
                    />
                  )
                })}
              </div>
            </div>
          )}

          {/* Calendar + Time Slots */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <Label className="mb-2 block">Selecciona fecha</Label>
              <MonthCalendar
                selectedDate={selection.date}
                availabilityByDate={availabilityByDate}
                onDateSelect={handleDateSelect}
                onMonthChange={handleMonthChange}
              />
            </div>

            <div>
              <Label className="mb-2 block">
                {selection.date ? `Horarios para ${formatFecha(selection.date)}` : "Selecciona una fecha"}
              </Label>
              {(availability.data?.items?.length ?? 0) > 0 ? (
                <ul className="grid gap-2" role="listbox" aria-label="Horarios disponibles">
                  {availability.data!.items.map((s: AvailabilitySlot) => (
                    <li key={s.scheduleId}>
                      <button
                        type="button"
                        onClick={() => handleSlotSelect(s.scheduleId)}
                        disabled={s.available <= 0}
                        aria-selected={s.scheduleId === selection.scheduleId}
                        aria-label={`${formatHora(s.startTime)} a ${formatHora(s.endTime)}, ${s.available} cupos libres de ${s.slotCapacity}`}
                        data-testid={`slot-${s.scheduleId}`}
                        role="option"
                        className={cn(
                          "w-full flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-all",
                          "outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                          s.available <= 0 && "opacity-50 cursor-not-allowed",
                          s.scheduleId === selection.scheduleId && "border-primary bg-primary/5 ring-1 ring-primary",
                          s.scheduleId !== selection.scheduleId && s.available > 0 && "hover:border-primary/50 hover:bg-accent/50"
                        )}
                      >
                        <span className="font-medium">
                          {formatHora(s.startTime)}–{formatHora(s.endTime)}
                        </span>
                        <span className="text-muted-foreground">
                          {s.available} cupos libres de {s.slotCapacity}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : availability.isFetched && !availability.isFetching ? (
                <p className="text-sm text-muted-foreground">
                  Sin horarios disponibles para esa fecha.
                </p>
              ) : selection.date && selection.specialtyId ? (
                <p className="text-sm text-muted-foreground">Cargando horarios...</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Selecciona una especialidad y fecha para ver horarios.
                </p>
              )}
            </div>
          </div>

          {/* Continue Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleContinue}
              disabled={!canContinue}
              data-testid="btn-continuar"
            >
              Revisar y confirmar
            </Button>
          </div>
        </div>
      )}

      {/* Error / Success Messages */}
      {err && (
        <p className="text-sm text-destructive" role="alert" data-testid="agendar-error">
          {err}
        </p>
      )}
      {msg && (
        <p className="text-sm text-primary" role="status" data-testid="agendar-exito">
          {msg}
        </p>
      )}

      {/* Step 2: Confirm Dialog */}
      <Dialog open={step === "confirm"} onOpenChange={(open) => !open && handleBack()}>
        <DialogContent data-testid="dialog-confirm">
          <DialogHeader>
            <DialogTitle>Confirmar cita</DialogTitle>
            <DialogDescription>
              Revisa los detalles antes de confirmar tu cita médica.
            </DialogDescription>
          </DialogHeader>

          {selectedDoctor && selectedSlot && (
            <div className="grid gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Doctor</span>
                <span className="font-medium text-right">{selectedDoctor.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Especialidad</span>
                <span className="font-medium text-right">{selectedSpecialtyName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fecha</span>
                <span className="font-medium text-right">{formatFecha(selection.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hora</span>
                <span className="font-medium text-right">
                  {formatHora(selectedSlot.startTime)} – {formatHora(selectedSlot.endTime)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cupos disponibles</span>
                <span className="font-medium text-right">{selectedSlot.available}</span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleBack} data-testid="btn-volver">
              Volver
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={book.isPending}
              aria-disabled={book.isPending}
              data-testid="btn-confirmar"
            >
              {book.isPending ? "Confirmando..." : "Confirmar Cita"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
