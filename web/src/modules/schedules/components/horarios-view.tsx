"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Resolver } from "react-hook-form";
import {
  useSchedules,
  useCreateSchedule,
  useUpdateSchedule,
  useDeleteSchedule,
  daysToBitmask,
  bitmaskToDays,
  DIAS,
} from "../queries";
import { useDoctores } from "@/modules/staff-admin/queries";
import { useEspecialidades } from "@/modules/catalogs/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const selectClass = "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

const franjaSchema = z.object({
  doctorId: z.string().uuid("Selecciona un doctor"),
  specialtyId: z.string().uuid("Selecciona una especialidad"),
  dias: z.array(z.number().min(0).max(6)).min(1, "Elige al menos un día"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
  slotCapacity: z.coerce.number().int().min(1, "Mínimo 1 cupo"),
  observation: z.string().max(500).optional(),
}).refine(d => d.endTime > d.startTime, { message: "La hora fin debe ser posterior al inicio", path: ["endTime"] });

type FranjaInput = z.infer<typeof franjaSchema>;

export function HorariosView() {
  const [fDoctor, setFDoctor] = useState("");
  const [fEsp, setFEsp] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<null | { id: string }>(null);
  const [crearAbierto, setCrearAbierto] = useState(false);

  const horarios = useSchedules({ doctorId: fDoctor || undefined, specialtyId: fEsp || undefined, status: fEstado || undefined, page });
  const doctores = useDoctores();
  const especialidades = useEspecialidades();
  const crear = useCreateSchedule();
  const actualizar = useUpdateSchedule();
  const eliminar = useDeleteSchedule();

  return (
    <section className="grid gap-4" data-testid="horarios-vista">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="f-doc">Doctor</Label>
          <select id="f-doc" className={selectClass} value={fDoctor} onChange={e => { setFDoctor(e.target.value); setPage(1); }}>
            <option value="">Todos</option>
            {(doctores.data?.items ?? []).map(d => <option key={d.id} value={d.id}>{d.fullName}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="f-esp">Especialidad</Label>
          <select id="f-esp" className={selectClass} value={fEsp} onChange={e => { setFEsp(e.target.value); setPage(1); }}>
            <option value="">Todas</option>
            {(especialidades.data ?? []).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="f-est">Estado</Label>
          <select id="f-est" className={selectClass} value={fEstado} onChange={e => { setFEstado(e.target.value); setPage(1); }}>
            <option value="">Todos</option>
            <option value="ACTIVE">Activo</option>
            <option value="INACTIVE">Inactivo</option>
          </select>
        </div>
        <Button className="ml-auto" data-testid="abrir-crear-franja" onClick={() => setCrearAbierto(true)}>Nueva franja</Button>
      </div>

      <Table>
        <TableHeader><TableRow><TableHead>Doctor</TableHead><TableHead>Especialidad</TableHead><TableHead>Días</TableHead><TableHead>Horario</TableHead><TableHead>Cupos</TableHead><TableHead>Estado</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader>
        <TableBody>
          {(horarios.data?.items ?? []).map(h => (
            <TableRow key={h.id}>
              <TableCell>{h.doctorName}</TableCell>
              <TableCell>{h.specialtyName}</TableCell>
              <TableCell>{bitmaskToDays(h.daysBitmask).map(d => DIAS[d]).join(", ")}</TableCell>
              <TableCell>{h.startTime}–{h.endTime}</TableCell>
              <TableCell>{h.slotCapacity}</TableCell>
              <TableCell>{h.status}</TableCell>
              <TableCell className="flex gap-2">
                <Button size="sm" variant="outline" data-testid={`editar-${h.id}`} onClick={() => setEditing({ id: h.id })}>Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => eliminar.mutate(h.id)} data-testid={`eliminar-${h.id}`}>Eliminar</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex items-center gap-2 text-sm">
        <Button variant="outline" size="sm" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Anterior</Button>
        <span>Página {horarios.data?.page ?? page} de {horarios.data?.totalPages ?? 1}</span>
        <Button variant="outline" size="sm" disabled={(horarios.data?.totalPages ?? 1) <= page} onClick={()=>setPage(p=>p+1)}>Siguiente</Button>
      </div>

      {crearAbierto ? <FranjaDialog onClose={()=>setCrearAbierto(false)} onSave={async (v)=>{ await crear.mutateAsync({ doctorId: v.doctorId, specialtyId: v.specialtyId, daysBitmask: daysToBitmask(v.dias), startTime: v.startTime, endTime: v.endTime, slotCapacity: v.slotCapacity, observation: v.observation }); setCrearAbierto(false); }} /> : null}
      {editing ? <FranjaDialog horarioId={editing.id} onClose={()=>setEditing(null)} onSave={async (v)=>{ await actualizar.mutateAsync({ id: editing.id, body: { daysBitmask: daysToBitmask(v.dias), startTime: v.startTime, endTime: v.endTime, slotCapacity: v.slotCapacity, observation: v.observation } }); setEditing(null); }} /> : null}
    </section>
  );
}

function FranjaDialog({ horarioId, onClose, onSave }: { horarioId?: string; onClose: ()=>void; onSave: (v: FranjaInput)=>Promise<void> }) {
  const doctores = useDoctores();
  const especialidades = useEspecialidades();
  const [error, setError] = useState<string|null>(null);
  const { register, handleSubmit, formState:{errors, isSubmitting}, watch, setValue } = useForm<FranjaInput>({
    resolver: zodResolver(franjaSchema) as unknown as Resolver<FranjaInput>,
    defaultValues: { dias: [], slotCapacity: 5, startTime:"08:00", endTime:"12:00" } as never,
  });
  const dias = watch("dias") ?? [];
  const toggleDia = (d:number) => {
    const next = dias.includes(d) ? dias.filter(x=>x!==d) : [...dias, d].sort((a,b)=>a-b);
    setValue("dias", next, { shouldValidate: true });
  };
  const submit = async (v: FranjaInput) => {
    setError(null);
    try { await onSave(v); } catch(e){ setError(e instanceof Error ? e.message : String(e)); }
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-label={horarioId ? "Editar franja" : "Nueva franja"}>
      <div className="w-full max-w-2xl rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">{horarioId ? "Editar franja" : "Nueva franja"}</h2>
        <form onSubmit={handleSubmit(submit)} noValidate className="mt-4 grid gap-4" aria-label="Formulario de franja">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="franja-doctor">Doctor</Label>
              <select id="franja-doctor" className={selectClass+" w-full"} {...register("doctorId")}>
                <option value="">Selecciona</option>
                {(doctores.data?.items ?? []).map(d=> <option key={d.id} value={d.id}>{d.fullName}</option>)}
              </select>
              {errors.doctorId ? <p className="text-sm text-destructive" role="alert">{errors.doctorId.message}</p> : null}
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="franja-esp">Especialidad</Label>
              <select id="franja-esp" className={selectClass+" w-full"} {...register("specialtyId")}>
                <option value="">Selecciona</option>
                {(especialidades.data ?? []).map(e=> <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              {errors.specialtyId ? <p className="text-sm text-destructive" role="alert">{errors.specialtyId.message}</p> : null}
            </div>
          </div>

          <div>
            <Label>Días de atención</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {DIAS.map((label, idx) => (
                <label key={idx} className={`flex items-center gap-1 rounded-md border px-2 py-1 text-sm ${dias.includes(idx) ? "bg-primary text-primary-foreground" : ""}`}>
                  <input type="checkbox" checked={dias.includes(idx)} onChange={()=>toggleDia(idx)} className="sr-only" />
                  {label}
                </label>
              ))}
            </div>
            {errors.dias ? <p className="text-sm text-destructive" role="alert">{errors.dias.message}</p> : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="franja-inicio">Hora inicio</Label>
              <Input id="franja-inicio" type="time" {...register("startTime")} />
              {errors.startTime ? <p className="text-sm text-destructive" role="alert">{errors.startTime.message}</p> : null}
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="franja-fin">Hora fin</Label>
              <Input id="franja-fin" type="time" {...register("endTime")} />
              {errors.endTime ? <p className="text-sm text-destructive" role="alert">{errors.endTime.message}</p> : null}
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="franja-cupos">Cupos</Label>
              <Input id="franja-cupos" type="number" min={1} {...register("slotCapacity")} />
              {errors.slotCapacity ? <p className="text-sm text-destructive" role="alert">{errors.slotCapacity.message}</p> : null}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="franja-obs">Observación</Label>
            <Input id="franja-obs" placeholder="Opcional" {...register("observation")} />
          </div>

          {error ? <p className="text-sm text-destructive" role="alert" data-testid="franja-error">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting} data-testid="franja-guardar">{isSubmitting ? "Guardando…" : "Guardar"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
