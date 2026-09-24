"use client";
import { useState } from "react";
import { ChevronDown, Check, X, Calendar, Loader2 } from "lucide-react";
import { useAgendaDoctor, useCambiarEstado, useCrearFollowUp } from "../queries";
import { useAppointmentWebSocket } from "../hooks/useAppointmentWebSocket";
import { FollowUpModal } from "./follow-up-modal";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface HorarioCardProps {
  horario: {
    scheduleId: string;
    specialtyId: string;
    specialtyName: string;
    startTime: string;
    endTime: string;
    slotCapacity: number;
    bookedCount: number;
    appointments: Array<{
      id: string;
      position: number | null;
      patientId: string;
      patientName: string;
      status: string;
      observation: string | null;
    }>;
  };
  onOpenFollowUp: (cita: {
    id: string;
    patientId: string;
    patientName: string;
    specialtyId: string;
    specialtyName: string;
  }) => void;
}

function HorarioCard({ horario, onOpenFollowUp }: HorarioCardProps) {
  const cambiarEstado = useCambiarEstado();

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="font-medium">{horario.startTime} – {horario.endTime}</span>
          <span className="ml-2 text-sm px-2 py-0.5 bg-secondary rounded">{horario.specialtyName}</span>
        </div>
        <div className="text-sm text-muted-foreground">
          {horario.bookedCount}/{horario.slotCapacity} cupos
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Pos</TableHead>
            <TableHead>Paciente</TableHead>
            <TableHead className="w-36">Estado</TableHead>
            <TableHead className="w-56">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: horario.slotCapacity }, (_, i) => i + 1).map((pos) => {
            const cita = horario.appointments.find((a) => a.position === pos);
            const isPending = cita?.status === "PENDING";
            const isConfirmed = cita?.status === "CONFIRMED";
            const isCompleted = cita?.status === "COMPLETED";
            const isNoShow = cita?.status === "NO_SHOW";
            const isCancelled = cita?.status === "CANCELLED";
            const isTerminal = isCompleted || isNoShow || isCancelled;

            return (
              <TableRow key={`${horario.scheduleId}-${pos}`}>
                <TableCell>{pos}</TableCell>
                <TableCell>{cita?.patientName ?? "— Cupo libre —"}</TableCell>
                <TableCell>
                  {cita ? (
                    <span className={cn(
                      "px-2 py-0.5 text-xs rounded",
                      isPending && "bg-yellow-100 text-yellow-800",
                      isConfirmed && "bg-blue-100 text-blue-800",
                      isCompleted && "bg-green-100 text-green-800",
                      isNoShow && "bg-red-100 text-red-800",
                      isCancelled && "bg-gray-100 text-gray-600"
                    )}>
                      {cita.status}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">Disponible</span>
                  )}
                </TableCell>
                <TableCell>
                  {cita ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          data-testid={`dropdown-${cita.id}`}
                          size="sm"
                          variant={isPending ? "default" : isConfirmed ? "default" : isCompleted ? "outline" : "outline"}
                          className="w-[110px] flex items-center gap-1"
                          onClick={() => {
                            if (isPending) {
                              cambiarEstado({ id: cita.id, status: "CONFIRMED" });
                            } else if (isConfirmed) {
                              cambiarEstado({ id: cita.id, status: "COMPLETED" });
                            }
                          }}
                          disabled={isCancelled || isNoShow}
                        >
                          {isPending ? "Confirmar" : isConfirmed ? "Atendido" : isCompleted ? "Completada" : cita.status}
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" sideOffset={5}>
                        {isPending && (
                          <>
                            <DropdownMenuItem
                              data-testid={`conf-${cita.id}`}
                              onClick={() => cambiarEstado({ id: cita.id, status: "CONFIRMED" })}
                              className="text-green-600 focus:text-green-600 font-medium"
                            >
                              <Check className="mr-2 h-3 w-3" /> Confirmar asistencia
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              data-testid={`na-${cita.id}`}
                              onClick={() => cambiarEstado({ id: cita.id, status: "NO_SHOW" })}
                            >
                              <X className="mr-2 h-3 w-3" /> No asistió
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        {isConfirmed && (
                          <>
                            <DropdownMenuItem
                              data-testid={`aten-${cita.id}`}
                              onClick={() => cambiarEstado({ id: cita.id, status: "COMPLETED" })}
                              className="text-green-600 focus:text-green-600 font-medium"
                            >
                              <Check className="mr-2 h-3 w-3" /> Atendido
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              data-testid={`na-${cita.id}`}
                              onClick={() => cambiarEstado({ id: cita.id, status: "NO_SHOW" })}
                            >
                              <X className="mr-2 h-3 w-3" /> No asistió
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        {isCompleted && (
                          <>
                            <DropdownMenuItem
                              disabled
                              className="text-muted-foreground"
                            >
                              <Check className="mr-2 h-3 w-3 opacity-50" /> Atendido
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled
                              className="text-muted-foreground"
                            >
                              <X className="mr-2 h-3 w-3 opacity-50" /> No asistió
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        {(isCompleted || isConfirmed) && (
                          <DropdownMenuItem
                            onClick={() => onOpenFollowUp({
                              id: cita.id,
                              patientId: cita.patientId,
                              patientName: cita.patientName,
                              specialtyId: horario.specialtyId,
                              specialtyName: horario.specialtyName,
                            })}
                            className="text-blue-600 focus:text-blue-600"
                          >
                            <Calendar className="mr-2 h-3 w-3" /> Agendar control
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <span className="text-muted-foreground text-xs">Disponible</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function AgendaDoctor() {
  const [fecha, setFecha] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [followUpCita, setFollowUpCita] = useState<{
    id: string;
    patientId: string;
    patientName: string;
    specialtyId: string;
    specialtyName: string;
    doctorId: string;
  } | null>(null);

  const { data: agenda } = useAgendaDoctor({ date: fecha });
  const { mutate: crearFollowUp } = useCrearFollowUp();

  useAppointmentWebSocket(agenda?.doctorId, fecha);

  const handleOpenFollowUp = (cita: { id: string; patientId: string; patientName: string; specialtyId: string; specialtyName: string }) => {
    setFollowUpCita({ ...cita, doctorId: agenda?.doctorId || "" });
  };

  const handleCloseFollowUp = () => {
    setFollowUpCita(null);
  };

  return (
    <section data-testid="agenda-doctor" className="space-y-6">
      <div className="flex items-center gap-3">
        <label htmlFor="agenda-fecha" className="text-sm">Fecha</label>
        <input
          id="agenda-fecha"
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        />
      </div>

      {agenda?.items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No hay horarios configurados para este día.
        </div>
      ) : (
        <div className="space-y-4">
          {agenda?.items.map((horario) => (
            <HorarioCard
              key={horario.scheduleId}
              horario={horario}
              onOpenFollowUp={handleOpenFollowUp}
            />
          ))}
        </div>
      )}

      {followUpCita && (
        <FollowUpModal
          cita={followUpCita}
          doctorId={agenda?.doctorId || ""}
          onClose={handleCloseFollowUp}
        />
      )}
    </section>
  );
}