"use client";
import { useState, useEffect } from "react";
import { AlertCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useHorariosDisponibles, useCrearFollowUp } from "../queries";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";

interface FollowUpModalProps {
  cita: {
    id: string;
    patientId: string;
    patientName: string;
    specialtyId: string;
    specialtyName: string;
  };
  doctorId: string;
  onClose: () => void;
}

function DatePicker({ value, onChange, min, max, disabled }: {
  value: string;
  onChange: (v: string) => void;
  min: string;
  max: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      min={min}
      max={max}
      disabled={disabled}
      className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
    />
  );
}

export function FollowUpModal({ cita, doctorId, onClose }: FollowUpModalProps) {
  const [fecha, setFecha] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [horarioSeleccionado, setHorarioSeleccionado] = useState<string>("");
  const [showHorarios, setShowHorarios] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const maxDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return d.toISOString().slice(0, 10);
  })();

  const { data: horarios, isLoading, error } = useHorariosDisponibles({
    doctorId,
    specialtyId: cita.specialtyId,
    date: fecha,
  });

  const crearFollowUp = useCrearFollowUp();

  useEffect(() => {
    setHorarioSeleccionado("");
  }, [fecha]);

  const handleFechaChange = (nuevaFecha: string) => {
    setFecha(nuevaFecha);
    setHorarioSeleccionado("");
  };

  const horariosConCupo = horarios?.items.filter((h) => h.available > 0) ?? [];
  const horariosSinCupo = horarios?.items.filter((h) => h.available === 0) ?? [];

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva cita de control</DialogTitle>
          <DialogDescription>
            Paciente: <strong>{cita.patientName}</strong> · Especialidad: <strong>{cita.specialtyName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Fecha de control</Label>
            <DatePicker
              value={fecha}
              onChange={handleFechaChange}
              min={today}
              max={maxDate}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Rango: {new Date(today).toLocaleDateString("es-HN")} –{" "}
              {new Date(maxDate).toLocaleDateString("es-HN")}
            </p>
          </div>

          <div>
            <Label className="flex items-center justify-between">
              Horarios disponibles en {cita.specialtyName}
              <Button
                variant="ghost"
                size="sm"
                className="ml-2 h-6 px-2 py-0 text-xs"
                onClick={() => setShowHorarios(!showHorarios)}
              >
                {showHorarios ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            </Label>

            {isLoading && (
              <div className="space-y-2 mt-2" role="status" aria-label="Cargando horarios">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 w-full animate-pulse rounded-lg border border-muted bg-muted" />
                ))}
              </div>
            )}

            {error && (
              <div className="border-red-500 text-red-800 bg-red-50 p-3 rounded-lg mt-2">
                <AlertCircle className="h-4 w-4" />
                <p>Error cargando horarios: {(error as Error).message}</p>
              </div>
            )}

            {!isLoading && !error && (
              <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                {horariosConCupo.length === 0 && horariosSinCupo.length === 0 ? (
                  <div className="border-yellow-500 text-yellow-800 bg-yellow-50 p-3 rounded-lg">
                    <AlertCircle className="h-4 w-4" />
                    <p>
                      No hay horarios de {cita.specialtyName} con cupo para el {new Date(fecha).toLocaleDateString(
                        "es-HN"
                      )}. Pruebe otra fecha.
                    </p>
                  </div>
                ) : (
                  <div>
                    {horariosConCupo.map((h) => (
                      <RadioOption
                        key={h.scheduleId}
                        value={h.scheduleId}
                        checked={horarioSeleccionado === h.scheduleId}
                        onChange={() => setHorarioSeleccionado(h.scheduleId)}
                        startTime={h.startTime}
                        endTime={h.endTime}
                        specialtyName={h.specialtyName}
                        available={h.available}
                        capacity={h.capacity}
                      />
                    ))}
                    {showHorarios &&
                      horariosSinCupo.map((h) => (
                        <div
                          key={h.scheduleId}
                          className={cn(
                            "flex items-center justify-between p-3 border rounded-lg opacity-50 cursor-not-allowed"
                          )}
                        >
                          <div className="flex flex-col">
                            <div className="font-medium line-through">
                              {h.startTime} – {h.endTime}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {h.specialtyName} · Completo ({h.capacity}/{h.capacity})
                            </div>
                          </div>
                          <span className="text-xs text-red-500">Sin cupo</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={isLoading || crearFollowUp.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!horarioSeleccionado) return;
                crearFollowUp.mutate(
                  {
                    patientId: cita.patientId,
                    scheduleId: horarioSeleccionado,
                    date: fecha,
                    originalAppointmentId: cita.id,
                  },
                  {
                    onSuccess: () => {
                      alert("Cita de control agendada correctamente");
                      onClose();
                    },
                    onError: (error: Error) => {
                      alert(error.message);
                    },
                  }
                );
              }}
              disabled={!horarioSeleccionado || isLoading || crearFollowUp.isPending}
              className="w-full"
            >
              {crearFollowUp.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Agendando...
                </>
              ) : isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cargando horarios...
                </>
              ) : (
                "Agendar cita de control"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}

function RadioOption({
  value,
  checked,
  onChange,
  startTime,
  endTime,
  specialtyName,
  available,
  capacity,
}: {
  value: string;
  checked: boolean;
  onChange: () => void;
  startTime: string;
  endTime: string;
  specialtyName: string;
  available: number;
  capacity: number;
}) {
  return (
    <label
      className={cn(
        "flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors",
        "hover:bg-accent",
        checked && "border-primary bg-accent"
      )}
    >
      <div className="flex items-center gap-3">
        <input
          type="radio"
          value={value}
          checked={checked}
          onChange={onChange}
          className="h-4 w-4 text-primary focus-visible:ring-2 focus-visible:ring-primary"
        />
        <div className="flex flex-col">
          <div className="font-medium">{startTime} – {endTime}</div>
          <div className="text-sm text-muted-foreground">
            {specialtyName} · {available} de {capacity} cupos
          </div>
        </div>
      </div>
    </label>
  );
}