import { HorariosView } from "@/modules/schedules/components/horarios-view";
export default function HorariosPage(){
  return (<section className="grid gap-6"><header><h1 className="text-2xl font-semibold text-balance">Horarios de atención</h1><p className="text-sm text-muted-foreground">Franjas por doctor y especialidad con días, horario y cupos.</p></header><HorariosView /></section>);
}
