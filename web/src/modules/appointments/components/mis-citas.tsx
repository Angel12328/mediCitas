"use client";
import { useAppointments, useCambiarEstado } from "../queries";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
export function MisCitas(){
  const lista=useAppointments(); const cambiar=useCambiarEstado();
  const esFutura=(d:string)=> new Date(d) >= new Date(new Date().toISOString().slice(0,10));
  return (
    <section data-testid="mis-citas">
      <Table><TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Hora</TableHead><TableHead>Doctor</TableHead><TableHead>Estado</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader>
      <TableBody>{(lista.data?.items??[]).map(c=> (
        <TableRow key={c.id}><TableCell>{String(c.date).slice(0,10)}</TableCell><TableCell>{c.startTime}</TableCell><TableCell>{c.doctorName}</TableCell><TableCell>{c.status}</TableCell><TableCell>
          {esFutura(String(c.date)) && (c.status==="PENDING"||c.status==="CONFIRMED") ? <Button size="sm" variant="outline" onClick={()=>cambiar.mutate({id:c.id, status:"CANCELLED"})} data-testid={`cancelar-${c.id}`}>Cancelar</Button> : null}
        </TableCell></TableRow>
      ))}</TableBody></Table>
    </section>
  );
}
