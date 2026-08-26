"use client";
import { useState } from "react";
import { useAppointments, useCambiarEstado, useAgregarObservacion } from "../queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
const sel="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs";
export function GestionCitas(){
  const [fecha,setFecha]=useState(""); const [estado,setEstado]=useState(""); const [page,setPage]=useState(1);
  const lista=useAppointments({date: fecha||undefined, status: estado||undefined, page}); const cambiar=useCambiarEstado(); const obs=useAgregarObservacion();
  const [obsPorId,setObsPorId]=useState<Record<string,string>>({});
  return (
    <section className="grid gap-4" data-testid="gestion-citas">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1"><Label htmlFor="gc-fecha">Fecha</Label><Input id="gc-fecha" type="date" value={fecha} onChange={e=>{setFecha(e.target.value); setPage(1);}} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="gc-estado">Estado</Label><select id="gc-estado" className={sel} value={estado} onChange={e=>{setEstado(e.target.value); setPage(1);}}><option value="">Todos</option><option value="PENDING">Pendiente</option><option value="CONFIRMED">Confirmada</option><option value="COMPLETED">Atendida</option><option value="CANCELLED">Cancelada</option><option value="NO_SHOW">No asistió</option></select></div>
      </div>
      <Table><TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Paciente</TableHead><TableHead>Doctor</TableHead><TableHead>Estado</TableHead><TableHead>Observación</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader>
      <TableBody>{(lista.data?.items??[]).map(c=> (
        <TableRow key={c.id}><TableCell>{String(c.date).slice(0,10)}</TableCell><TableCell>{c.patientName}</TableCell><TableCell>{c.doctorName}</TableCell><TableCell>{c.status}</TableCell><TableCell className="max-w-[20ch] truncate">{c.observation ?? "—"}</TableCell><TableCell className="flex flex-wrap gap-2">
          {(c.status==="PENDING"||c.status==="CONFIRMED") ? <Button size="sm" variant="outline" onClick={()=>cambiar.mutate({id:c.id, status:"CANCELLED"})} data-testid={`gc-cancelar-${c.id}`}>Cancelar</Button> : null}
          <div className="flex items-center gap-1"><Input placeholder="Nota" className="h-8 w-28" value={obsPorId[c.id]??""} onChange={e=>setObsPorId(s=>({...s,[c.id]:e.target.value}))} /><Button size="sm" variant="ghost" onClick={()=>obs.mutate({id:c.id, observation: obsPorId[c.id]??""})} data-testid={`gc-obs-${c.id}`}>Guardar nota</Button></div>
        </TableCell></TableRow>
      ))}</TableBody></Table>
      <div className="flex items-center gap-2 text-sm"><Button variant="outline" size="sm" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Anterior</Button><span>Página {lista.data?.page ?? page}</span><Button variant="outline" size="sm" disabled={(lista.data?.totalPages??1)<=page} onClick={()=>setPage(p=>p+1)}>Siguiente</Button></div>
    </section>
  );
}
