"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { appUrl } from "@/shared/api/client-url";

export interface AppointmentDto {
  id: string;
  date: string;
  position: number | null;
  status: string;
  observation: string | null;
  patientId: string;
  patientName: string;
  scheduleId: string;
  startTime: string;
  endTime: string;
  specialtyId: string;
  specialtyName: string;
  doctorId: string;
  doctorName: string;
}

export interface AgendaHorario {
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
}

export interface HorarioDisponible {
  scheduleId: string;
  specialtyId: string;
  specialtyName: string;
  startTime: string;
  endTime: string;
  capacity: number;
  booked: number;
  available: number;
}

interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
async function getPage<T>(path:string): Promise<Page<T>>{ const r=await fetch(appUrl(`/api/proxy${path}`),{cache:"no-store"}); if(!r.ok){const b=await r.json().catch(()=>null) as {title?:string;detail?:string}|null; throw new Error(b?.detail??b?.title??`Error ${r.status}`);} return r.json() as Promise<Page<T>>; }
export function useAppointments(f:{date?:string; status?:string; doctorId?:string; patientId?:string; page?:number}={}){
  const qs=new URLSearchParams(); if(f.date) qs.set("date",f.date); if(f.status) qs.set("status",f.status); if(f.doctorId) qs.set("doctorId",f.doctorId); if(f.patientId) qs.set("patientId",f.patientId); qs.set("page",String(f.page??1)); qs.set("pageSize","10");
  return useQuery({queryKey:["appointments", f], queryFn:()=>getPage<AppointmentDto>(`/appointments?${qs}`)});
}
export function useBookAppointment(){
  const qc=useQueryClient();
  return useMutation({
    mutationFn: async(body:{scheduleId:string; date:string})=>{
      let attempt = 0;
      const maxRetries = 3;
      while (true) {
        try {
          const r = await fetch(appUrl("/api/proxy/appointments"), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!r.ok) {
            const b = await r.json().catch(() => null) as { title?: string; detail?: string; code?: string } | null;
            // Retry on concurrent booking conflict
            if (b?.code === "CONCURRENT_BOOKING" && attempt < 3) {
              attempt++;
              await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
              continue;
            }
            throw new Error(b?.detail ?? b?.title ?? `Error ${r.status}`);
          }
          return r.json();
        } catch (e) {
          if (e instanceof Error && e.message.includes("CONCURRENT_BOOKING") && attempt < 3) {
            attempt++;
            await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
            continue;
          }
          throw e;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["availability"] });
    },
  });
}
export function useCambiarEstado() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const r = await fetch(appUrl(`/api/proxy/appointments/${id}/status`), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) {
        const b = (await r.json().catch(() => null)) as { title?: string; detail?: string } | null;
        throw new Error(b?.detail ?? b?.title ?? `Error ${r.status}`);
      }
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });

  return mutation.mutate;
}
export function useAgregarObservacion(){
  const qc=useQueryClient();
  return useMutation({
    mutationFn: async({id,observation}:{id:string;observation:string})=>{
      const r=await fetch(appUrl(`/api/proxy/appointments/${id}/observations`),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({observation})});
      if(!r.ok){ const b=await r.json().catch(()=>null) as {title?:string}|null; throw new Error(b?.title??`Error ${r.status}`);}
      return r.json();
    },
    onSuccess:()=> qc.invalidateQueries({queryKey:["appointments"]}),
  });
}

interface AgendaDoctorResponse {
  items: Array<{
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
  }>;
  doctorId: string;
}

export function useAgendaDoctor(f: { date: string }) {
  const qs = new URLSearchParams();
  qs.set("date", f.date);
  return useQuery<AgendaDoctorResponse>({
    queryKey: ["agenda-doctor", f.date],
    queryFn: async () => {
      const r = await fetch(appUrl(`/api/proxy/doctors/me/agenda?${qs}`), { cache: "no-store" });
      if (!r.ok) throw new Error("Error cargando agenda");
      const data = await r.json();
      return { items: data.items, doctorId: data.doctorId };
    },
    enabled: !!f.date,
  });
}

export function useHorariosDisponibles(f: { doctorId: string; specialtyId: string; date: string }) {
  const qs = new URLSearchParams();
  qs.set("doctorId", f.doctorId);
  qs.set("specialtyId", f.specialtyId);
  qs.set("date", f.date);
  return useQuery({
    queryKey: ["horarios-disponibles", f],
    queryFn: () => getPage<HorarioDisponible>(`/schedules/availability?${qs}`),
    enabled: !!f.doctorId && !!f.specialtyId && !!f.date,
  });
}

export function useCrearFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { patientId: string; scheduleId: string; date: string; originalAppointmentId?: string }) => {
      const r = await fetch(appUrl("/api/proxy/appointments/follow-up"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const b = await r.json().catch(() => null) as { title?: string; detail?: string } | null;
        throw new Error(b?.detail ?? b?.title ?? `Error ${r.status}`);
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["agenda-doctor"] });
    },
  });
}
