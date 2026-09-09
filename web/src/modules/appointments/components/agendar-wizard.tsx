"use client"
import { useState, useMemo, useCallback } from "react"
import { useEspecialidades } from "@/modules/catalogs/queries"
import { useDoctores, type DoctorItem } from "@/modules/staff-admin/queries"
import { useDoctorSchedules, useAvailability } from "@/modules/schedules/queries"
import { useBookAppointment } from "../queries"
import { DoctorCard } from "./doctor-card"
import { ScheduleDialog } from "./schedule-dialog"
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

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
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
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)

  const especialidades = useEspecialidades()

  // Fetch doctors with availability summary
  const doctores = useDoctores({
    specialtyId: selection.specialtyId || undefined,
    withAvailability: true,
    daysAhead: 30,
    sort: "availability",
  })

  const book = useBookAppointment()

  // Fetch schedules for selected doctor (for ScheduleDialog)
  const doctorSchedules = useDoctorSchedules(
    selection.doctorId || undefined,
    selection.specialtyId || undefined
  )

  const filteredDoctors = useMemo(() => {
    const items = (doctores.data?.items ?? []) as DoctorItem[]
    if (!doctorSearch.trim()) return items
    const search = doctorSearch.toLowerCase()
    return items.filter((d) => d.fullName.toLowerCase().includes(search))
  }, [doctores.data?.items, doctorSearch])

  const selectedDoctor = useMemo(() => {
    if (!selection.doctorId) return null
    return filteredDoctors.find((d) => d.id === selection.doctorId) ?? null
  }, [filteredDoctors, selection.doctorId])

  const selectedSpecialtyName = useMemo(() => {
    return especialidades.data?.find((e) => e.id === selection.specialtyId)?.name ?? ""
  }, [especialidades.data, selection.specialtyId])

  const canContinue = Boolean(
    selection.doctorId && selection.date && selection.scheduleId
  )

  const availability = useAvailability(
    selection.doctorId || undefined,
    selection.specialtyId || undefined,
    selection.date || undefined
  )

  const selectedSlot = useMemo(() => {
    if (!selection.scheduleId) return null
    return availability.data?.items?.find((s) => s.scheduleId === selection.scheduleId) ?? null
  }, [availability.data?.items, selection.scheduleId])

  const handleSpecialtyChange = useCallback((id: string) => {
    setSelection((s) => ({ ...s, specialtyId: id, doctorId: "", scheduleId: "" }))
    setDoctorSearch("")
  }, [])

  const handleDoctorSelect = useCallback((doctorId: string) => {
    setSelection((s) => ({ ...s, doctorId, scheduleId: "" }))
    setScheduleDialogOpen(true)
  }, [])

  const handleViewAgenda = useCallback((doctorId: string) => {
    setSelection((s) => ({ ...s, doctorId, scheduleId: "" }))
    setScheduleDialogOpen(true)
  }, [])

  const handleScheduleSelect = useCallback((scheduleId: string, date: string) => {
    setSelection((s) => ({ ...s, scheduleId, date }))
    setScheduleDialogOpen(false)
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

          {/* Availability filter */}
          {selection.specialtyId && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ag-filter-week"
                checked={false}
                onChange={() => {}}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="ag-filter-week" className="text-sm cursor-pointer">
                Solo con disponibilidad esta semana
              </Label>
            </div>
          )}

          {/* Doctor Cards Grid */}
          {selection.specialtyId && (
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                {filteredDoctors.length} doctor{filteredDoctors.length !== 1 ? "es" : ""} encontrado{filteredDoctors.length !== 1 ? "s" : ""}
              </p>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {filteredDoctors.map((doctor) => (
                  <DoctorCard
                    key={doctor.id}
                    doctor={doctor}
                    specialtyName={selectedSpecialtyName}
                    schedules={doctorSchedules.data?.filter(s => s.doctorName.includes(doctor.fullName.split(" ")[1])) ?? []}
                    availabilitySummary={doctor.availabilitySummary}
                    selected={doctor.id === selection.doctorId}
                    disabled={!doctor.availabilitySummary?.hasAvailabilityThisMonth}
                    onSelect={handleDoctorSelect}
                    onViewAgenda={handleViewAgenda}
                  />
                ))}
              </div>
            </div>
          )}

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

          {selectedDoctor && (
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
                  {formatHora(selectedSlot?.startTime ?? "")} – {formatHora(selectedSlot?.endTime ?? "")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cupos disponibles</span>
                <span className="font-medium text-right">{selectedSlot?.available ?? 0}</span>
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

      {/* Schedule Dialog */}
      <ScheduleDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        doctorId={selection.doctorId}
        specialtyId={selection.specialtyId}
        doctorName={selectedDoctor?.fullName ?? ""}
        specialtyName={selectedSpecialtyName}
        schedules={doctorSchedules.data ?? []}
        onSelect={handleScheduleSelect}
      />
    </section>
  )
}