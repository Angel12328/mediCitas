"use client";

/**
 * Consola de personal (empleados) - specs/web/staff-admin/spec.md
 * Alta desde usuario existente, estado y asignación de cargos con historial.
 */
import { useState } from "react";
import {
  useAsignarCargo,
  useCrearEmpleado,
  useEmpleados,
  useEstadoEmpleado,
  useHistorialCargos,
} from "../queries";
import { useCargos } from "@/modules/catalogs/queries";
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

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function PersonalView() {
  const empleados = useEmpleados();
  const cargos = useCargos();
  const crear = useCrearEmpleado();
  const estado = useEstadoEmpleado();
  const asignarCargo = useAsignarCargo();

  const [nuevoUserId, setNuevoUserId] = useState("");
  const [cargoPara, setCargoPara] = useState<string | null>(null);
  const [cargoId, setCargoId] = useState("");

  return (
    <section className="grid gap-4" aria-label="Gestión de personal" data-testid="personal-vista">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="emp-usuario">Usuario existente</Label>
          <Input
            id="emp-usuario"
            placeholder="userId del usuario"
            className="w-72"
            value={nuevoUserId}
            onChange={(e) => setNuevoUserId(e.target.value)}
          />
        </div>
        <Button
          disabled={!nuevoUserId || crear.isPending}
          onClick={async () => {
            await crear.mutateAsync({ userId: nuevoUserId });
            setNuevoUserId("");
          }}
          data-testid="empleado-crear"
        >
          Registrar empleado
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empleado</TableHead>
            <TableHead>Correo</TableHead>
            <TableHead>Cargo actual</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(empleados.data?.items ?? []).map((e) => (
            <TableRow key={e.id}>
              <TableCell>{e.fullName}</TableCell>
              <TableCell>{e.email}</TableCell>
              <TableCell>{e.currentCargo ?? "—"}</TableCell>
              <TableCell>{e.status}</TableCell>
              <TableCell className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => estado.mutate({ id: e.id, status: e.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })}
                >
                  {e.status === "ACTIVE" ? "Desactivar" : "Activar"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCargoPara(cargoPara === e.id ? null : e.id)}
                  data-testid={`cargos-toggle-${e.id}`}
                >
                  Cargos
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {cargoPara ? (
        <CargoPanel
          employeeId={cargoPara}
          cargos={(cargos.data as unknown as { items?: CatalogoCargo[] })?.items ?? []}
          cargoId={cargoId}
          setCargoId={setCargoId}
          onAsignar={async () => {
            await asignarCargo.mutateAsync({ employeeId: cargoPara, cargoId });
            setCargoId("");
          }}
        />
      ) : null}
    </section>
  );
}

function CargoPanel({
  employeeId,
  cargos,
  cargoId,
  setCargoId,
  onAsignar,
}: {
  employeeId: string;
  cargos: CatalogoCargo[];
  cargoId: string;
  setCargoId: (v: string) => void;
  onAsignar: () => Promise<void>;
}) {
  const historial = useHistorialCargos(employeeId);
  return (
    <div className="grid gap-3 rounded-md border p-4" data-testid={`cargo-panel-${employeeId}`}>
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="cargo-select">Nuevo cargo</Label>
          <select
            id="cargo-select"
            className={selectClass}
            value={cargoId}
            onChange={(e) => setCargoId(e.target.value)}
          >
            <option value="">Selecciona</option>
            {cargos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <Button disabled={!cargoId} onClick={() => void onAsignar()} data-testid="cargo-asignar">
          Asignar cargo
        </Button>
      </div>

      <p className="text-sm font-semibold text-muted-foreground">Historial</p>
      <ul className="grid gap-1 text-sm">
        {(historial.data?.items ?? []).map((h) => (
          <li key={`${h.cargoName}-${h.assignedAt}`}>
            {h.cargoName} · {new Date(h.assignedAt).toLocaleDateString("es-HN")}
          </li>
        ))}
        {historial.data?.items.length === 0 ? (
          <li className="text-muted-foreground">Sin cargos asignados aún.</li>
        ) : null}
      </ul>
    </div>
  );
}

// Input re-exportado para el campo userId
import { Input } from "@/components/ui/input";

interface CatalogoCargo {
  id: string;
  name: string;
}
