"use client";
import { useState } from "react";
import { useEspecialidades } from "@/modules/catalogs/queries";
import { useDoctores } from "@/modules/staff-admin/queries";
import { useAvailability } from "@/modules/schedules/queries";
import { useBookAppointment } from "../queries";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
const sel="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";
export function AgendarWizard(){
  const [esp,setEsp]=useState(""); const [doc,setDoc]=useState(""); const [fecha,setFecha]=useState(new Date().toISOString().slice(0,10));
  const [msg,setMsg]=useState<string|null>(null); const [err,setErr]=useState<string|null>(null);
  const especialidades=useEspecialidades(); const doctores=useDoctores(esp||undefined);
  const disp=useAvailability(doc||undefined, esp||undefined, fecha||undefined);
  const book=useBookAppointment();
  return (
    <section className="grid gap-4" data-testid="agendar-wizard">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1"><Label htmlFor="ag-esp">Especialidad</Label>
          <select id="ag-esp" className={sel} value={esp} onChange={e=>{setEsp(e.target.value); setDoc("");}}><option value="">Selecciona</option>{(especialidades.data??[]).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
        <div className="flex flex-col gap-1"><Label htmlFor="ag-doc">Doctor</Label>
          <select id="ag-doc" className={sel} value={doc} onChange={e=>setDoc(e.target.value)} disabled={!esp}><option value="">{esp?"Selecciona":"Elige especialidad"}</option>{(doctores.data?.items??[]).map((d: { id: string; fullName: string })=> <option key={d.id} value={d.id}>{d.fullName}</option>)}</select></div>
        <div className="flex flex-col gap-1"><Label htmlFor="ag-fecha">Fecha</Label><input id="ag-fecha" type="date" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={fecha} onChange={e=>setFecha(e.target.value)} /></div>
      </div>
      {(disp.data?.items?.length ?? 0) >0 ? (
        <ul className="grid gap-2">
          {disp.data!.items.map((s: { scheduleId: string; startTime: string; endTime: string; available: number; slotCapacity: number })=> (
            <li key={s.scheduleId} className="flex items-center justify-between rounded-md border px-3 py-2">
              <span>{s.startTime}–{s.endTime} · {s.available} cupos libres de {s.slotCapacity}</span>
              <Button size="sm" disabled={book.isPending} onClick={async()=>{
                setErr(null); setMsg(null);
                try{ const r=await book.mutateAsync({scheduleId:s.scheduleId, date:fecha}) as { position?: number }; setMsg(`Cita creada · posición ${r.position ?? "?"}`);}catch(e){ setErr(e instanceof Error?e.message:String(e));}
              }} data-testid={`reservar-${s.scheduleId}`}>Reservar</Button>
            </li>
          ))}
        </ul>
      ) : disp.isFetched && !disp.isFetching ? <p className="text-sm text-muted-foreground">Sin horarios disponibles para esa fecha.</p> : null}
      {err ? <p className="text-sm text-destructive" role="alert" data-testid="agendar-error">{err}</p> : null}
      {msg ? <p className="text-sm text-primary" role="status" data-testid="agendar-exito">{msg}</p> : null}
    </section>
  );
}
