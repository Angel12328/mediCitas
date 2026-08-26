"use client";

/**
 * Consola de doctores - specs/web/staff-admin/spec.md
 * Alta desde empleado, filtro por especialidad, estado y gestión de
 * especialidades (asignar/retirar).
 */
import { useState } from "react";
import {
  useAsignarEspecialidad,
  useCrearDoctor,
  useDoctores,
  useEstadoDoctor,
  useRetirarEspecialidad,
} from "../queries";
import { useEspecialidades } from "@/modules/catalogs/queries";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function DoctoresView() {
  const [specialtyId, setSpecialtyId] = useState("");
  const [nuevoEmployeeId, setNuevoEmployeeId] = useState("");
  const doctores = useDoctores(specialtyId || undefined);
  const especialidades = useEspecialidades();
  const crear = useCrearDoctor();
  const estado = useEstadoDoctor();
  const asignar = useAsignarEspecialidad();
  const retirar = useRetirarEspecialidad();

  return (
    <section className="grid gap-4" aria-label="Gestión de doctores" data-testid="doctores-vista">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="doc-especialidad">Filtrar por especialidad</Label>
          <select
            id="doc-especialidad"
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            value={specialtyId}
            onChange={(e) => setSpecialtyId(e.target.value)}
          >
            <option value="">Todas</option>
            {(especialidades.data ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="doc-empleado">Empleado existente</Label>
          <input
            id="doc-empleado"
            placeholder="employeeId"
            className="h-9 w-64 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            value={nuevoEmployeeId}
            onChange={(e) => setNuevoEmployeeId(e.target.value)}
          />
        </div>
        <Button
          disabled={!nuevoEmployeeId || crear.isPending}
          onClick={async () => {
            await crear.mutateAsync({ employeeId: nuevoEmployeeId });
            setNuevoEmployeeId("");
          }}
          data-testid="doctor-crear"
        >
          Registrar doctor
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Doctor</TableHead>
            <TableHead>Correo</TableHead>
            <TableHead>Especialidades</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(doctores.data?.items ?? []).map((d) => (
            <TableRow key={d.id}>
              <TableCell>{d.fullName}</TableCell>
              <TableCell>{d.email}</TableCell>
              <TableCell>{(d.specialties ?? []).join(", ") || "—"}</TableCell>
              <TableCell>{d.status}</TableCell>
              <TableCell className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    estado.mutate({ id: d.id, status: d.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })
                  }
                >
                  {d.status === "ACTIVE" ? "Desactivar" : "Activar"}
                </Button>
                {(especialidades.data ?? []).map((esp) => {
                  const activa = (d.specialties ?? []).includes(esp.name);
                  return activa ? (
                    <Button
                      key={`ret-${esp.id}`}
                      size="sm"
                      variant="ghost"
                      onClick={() => retirar.mutateAsync({ doctorId: d.id, specialtyId: esp.id })}
                      data-testid={`retirar-${d.id}-${esp.id}`}
                    >
                      Retirar {esp.name}
                    </Button>
                  ) : (
                    <Button
                      key={`asi-${esp.id}`}
                      size="sm"
                      variant="ghost"
                      onClick={() => asignar.mutateAsync({ doctorId: d.id, specialtyId: esp.id })}
                      data-testid={`asignar-${d.id}-${esp.id}`}
                    >
                      + {esp.name}
                    </Button>
                  );
                })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
