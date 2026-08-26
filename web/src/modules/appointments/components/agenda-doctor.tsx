"use client";
import { useState } from "react";
import { useAppointments, useCambiarEstado } from "../queries";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
export function AgendaDoctor(){
  const [fecha,setFecha]=useState(new Date().toISOString().slice(0,10));
  const lista=useAppointments({date:fecha}); const cambiar=useCambiarEstado();
  return (
    <section data-testid="agenda-doctor">
      <div className="flex items-center gap-3"><label htmlFor="agenda-fecha" className="text-sm">Fecha</label><input id="agenda-fecha" type="date" value={fecha} onChange={e=>setFecha(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" /></div>
      <Table><TableHeader><TableRow><TableHead>Pos.</TableHead><TableHead>Paciente</TableHead><TableHead>Hora</TableHead><TableHead>Estado</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader>
      <TableBody>{(lista.data?.items??[]).map(c=> (
        <TableRow key={c.id}><TableCell>{c.position ?? "-"}</TableCell><TableCell>{c.patientName}</TableCell><TableCell>{c.startTime}</TableCell><TableCell>{c.status}</TableCell><TableCell className="flex gap-2">
          <Button size="sm" variant="outline" onClick={()=>cambiar.mutate({id:c.id, status:"COMPLETED"})} data-testid={`aten-${c.id}`}>Atendido</Button>
          <Button size="sm" variant="ghost" onClick={()=>cambiar.mutate({id:c.id, status:"NO_SHOW"})} data-testid={`na-${c.id}`}>No asistió</Button>
        </TableCell></TableRow>
      ))}</TableBody></Table>
    </section>
  );
}
