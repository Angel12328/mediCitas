"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { appUrl } from "@/shared/api/client-url";
export interface AppointmentDto { id:string; date:string; position:number|null; status:string; observation:string|null; patientId:string; patientName:string; scheduleId:string; startTime:string; endTime:string; specialtyName:string; doctorId:string; doctorName:string; }
interface Page<T> { items:T[]; page:number; pageSize:number; total:number; totalPages:number; }
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
export function useCambiarEstado(){
  const qc=useQueryClient();
  return useMutation({
    mutationFn: async({id,status}:{id:string;status:string})=>{
      const r=await fetch(appUrl(`/api/proxy/appointments/${id}/status`),{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({status})});
      if(!r.ok){ const b=await r.json().catch(()=>null) as {title?:string;detail?:string}|null; throw new Error(b?.detail??b?.title??`Error ${r.status}`);}
      return r.json();
    },
    onSuccess:()=> qc.invalidateQueries({queryKey:["appointments"]}),
  });
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
