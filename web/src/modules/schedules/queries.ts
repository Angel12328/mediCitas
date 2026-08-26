"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { appUrl } from "@/shared/api/client-url";
export interface ScheduleItem { id:string; doctorName:string; specialtyName:string; daysBitmask:number; startTime:string; endTime:string; slotCapacity:number; status:string; }
export interface AvailabilitySlot { scheduleId:string; startTime:string; endTime:string; slotCapacity:number; booked:number; available:number; }
interface Page<T>{ items:T[]; page:number; pageSize:number; total:number; totalPages:number; }
async function fetchPage<T>(path:string):Promise<Page<T>>{ const r=await fetch(appUrl(`/api/proxy${path}`),{cache:"no-store"}); if(!r.ok){const b=await r.json().catch(()=>null) as {title?:string;detail?:string}|null; throw new Error(b?.detail??b?.title??`Error ${r.status}`);} return r.json() as Promise<Page<T>>; }
export function useSchedules(f:{doctorId?:string; specialtyId?:string; status?:string; page?:number}){
  const qs=new URLSearchParams(); if(f.doctorId) qs.set("doctorId",f.doctorId); if(f.specialtyId) qs.set("specialtyId",f.specialtyId); if(f.status) qs.set("status",f.status); qs.set("page",String(f.page??1)); qs.set("pageSize","10");
  return useQuery({queryKey:["schedules",f], queryFn:()=>fetchPage<ScheduleItem>(`/schedules?${qs}`)});
}
export function useAvailability(doctorId?:string, specialtyId?:string, date?:string){
  return useQuery({
    queryKey:["availability",doctorId,specialtyId,date], enabled:Boolean(doctorId&&specialtyId&&date),
    queryFn: async():Promise<{date:string;items:AvailabilitySlot[]}>=>{
      const qs=new URLSearchParams({doctorId:doctorId!,specialtyId:specialtyId!,date:date!});
      const r=await fetch(appUrl(`/api/proxy/schedules/availability?${qs}`),{cache:"no-store"});
      if(!r.ok){const b=await r.json().catch(()=>null) as {title?:string}|null; throw new Error(b?.title??`Error ${r.status}`);}
      return r.json();
    }
  });
}
export function useCreateSchedule(){ const qc=useQueryClient(); return useMutation({mutationFn: async(body:unknown)=>{ const r=await fetch(appUrl("/api/proxy/schedules"),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)}); if(!r.ok){const b=await r.json().catch(()=>null) as {detail?:string;title?:string}|null; throw new Error(b?.detail??b?.title??`Error ${r.status}`);} return r.json();}, onSuccess:()=>qc.invalidateQueries({queryKey:["schedules"]})});}
export function useUpdateSchedule(){ const qc=useQueryClient(); return useMutation({mutationFn: async({id,body}:{id:string;body:unknown})=>{ const r=await fetch(appUrl(`/api/proxy/schedules/${id}`),{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(body)}); if(!r.ok){const b=await r.json().catch(()=>null) as {detail?:string;title?:string}|null; throw new Error(b?.detail??b?.title??`Error ${r.status}`);} return r.json();}, onSuccess:()=>qc.invalidateQueries({queryKey:["schedules"]})});}
export function useDeleteSchedule(){ const qc=useQueryClient(); return useMutation({mutationFn: async(id:string)=>{ const r=await fetch(appUrl(`/api/proxy/schedules/${id}`),{method:"DELETE"}); if(!r.ok&&r.status!==204){const b=await r.json().catch(()=>null) as {title?:string}|null; throw new Error(b?.title??`Error ${r.status}`);} }, onSuccess:()=>qc.invalidateQueries({queryKey:["schedules"]})});}
export function bitmaskToDays(mask:number):number[]{ const out:number[]=[]; for(let d=0;d<7;d++) if(mask & (1<<d)) out.push(d); return out;}
export function daysToBitmask(days:number[]):number{ return days.reduce((m,d)=> m | (1<<d),0);}
export const DIAS=["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"] as const;
