"use client";

/**
 * Hooks del módulo de administración - mediCitas web
 * Listados paginados y mutaciones vía proxy autenticado.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { appUrl } from "@/shared/api/client-url";

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface UsuarioItem {
  id: string;
  email: string;
  status: string;
  createdAt: string;
  fullName: string;
  roles: string[];
}

export interface EmpleadoItem {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  currentCargo: string | null;
  status: string;
}

export interface DoctorItem {
  id: string;
  email: string;
  fullName: string;
  specialties?: string[];
  status: string;
  availabilitySummary?: {
    hasAvailabilityThisWeek: boolean;
    hasAvailabilityThisMonth: boolean;
    nextAvailableDate: string | null;
    nextSlot: { scheduleId: string; startTime: string; endTime: string; available: number; total: number } | null;
    totalSlotsThisMonth: number;
    totalAvailableThisMonth: number;
  };
}

async function getPage<T>(path: string): Promise<Page<T>> {
  const res = await fetch(appUrl(`/api/proxy${path}`), { cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo cargar ${path}`);
  return (await res.json()) as Page<T>;
}

async function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(appUrl(`/api/proxy${path}`), {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok && res.status !== 204) {
    const problem = (await res.json().catch(() => null)) as
      | { title?: string; detail?: string }
      | null;
    throw new Error(problem?.detail ?? problem?.title ?? `Error ${res.status}`);
  }
  return (res.status === 204 ? (undefined as T) : ((await res.json()) as T));
}

// ==================== Usuarios ====================
export interface FiltrosUsuarios {
  email?: string;
  status?: string;
  role?: string;
  page?: number;
}

function qs(f: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function useUsuarios(filtros: FiltrosUsuarios) {
  return useQuery({
    queryKey: ["usuarios", filtros],
    queryFn: () =>
      getPage<UsuarioItem>(
        `/users${qs({ ...filtros, pageSize: 10 })}`
      ),
  });
}

export function useRolesCatalogo() {
  return useQuery({
    queryKey: ["admin-roles"],
    queryFn: () => getPage<{ id: string; name: string; status: string }>("/roles"),
    staleTime: 1000 * 60 * 60,
  });
}

export function useCrearCuenta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) =>
      send<{ id: string }>("/users", "POST", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usuarios"] }),
  });
}

export function useCambiarEstadoUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      send(`/users/${id}/status`, "PATCH", { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usuarios"] }),
  });
}

export function useAsignarRol() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      send(`/users/${userId}/roles`, "POST", { roleId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usuarios"] }),
  });
}

export function useQuitarRol() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      send(`/users/${userId}/roles/${roleId}`, "DELETE"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usuarios"] }),
  });
}

// ==================== Empleados ====================
export function useEmpleados(page = 1) {
  return useQuery({
    queryKey: ["empleados", page],
    queryFn: () => getPage<EmpleadoItem>(`/employees?page=${page}&pageSize=10`),
  });
}

export function useCrearEmpleado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { userId: string }) =>
      send<EmpleadoItem>("/employees", "POST", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["empleados"] }),
  });
}

export function useEstadoEmpleado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      send(`/employees/${id}`, "PATCH", { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["empleados"] }),
  });
}

export function useAsignarCargo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeId, cargoId }: { employeeId: string; cargoId: string }) =>
      send(`/employees/${employeeId}/cargos`, "POST", { cargoId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empleados"] });
      qc.invalidateQueries({ queryKey: ["cargo-historial"] });
    },
  });
}

export function useHistorialCargos(employeeId: string | null) {
  return useQuery({
    queryKey: ["cargo-historial", employeeId],
    enabled: Boolean(employeeId),
    queryFn: async () => {
      const res = await fetch(
        appUrl(`/api/proxy/employees/${employeeId}/cargos`),
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("No se pudo cargar el historial");
      return (await res.json()) as {
        items: Array<{ cargoName: string; assignedAt: string }>;
        total: number;
      };
    },
  });
}

interface UseDoctoresOptions {
  specialtyId?: string;
  withAvailability?: boolean;
  daysAhead?: number;
  sort?: "availability" | "name" | "createdAt";
  filter?: "hasAvailabilityThisWeek";
  page?: number;
  pageSize?: number;
}

// ==================== Doctores ====================
export function useDoctores(options: UseDoctoresOptions = {}) {
  const {
    specialtyId,
    withAvailability,
    daysAhead = 30,
    sort,
    filter,
    page = 1,
    pageSize = 10,
  } = options;

  const qs = new URLSearchParams();
  if (specialtyId) qs.set("specialtyId", specialtyId);
  if (withAvailability) qs.set("withAvailability", "1");
  if (daysAhead) qs.set("daysAhead", String(daysAhead));
  if (sort) qs.set("sort", sort);
  if (filter) qs.set("filter", filter);
  qs.set("page", String(page));
  qs.set("pageSize", String(pageSize));

  return useQuery({
    queryKey: ["doctores", qs.toString()],
    queryFn: () => getPage<DoctorItem>(`/doctors?${qs}`),
    staleTime: 1000 * 30,
  });
}

export function useCrearDoctor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { employeeId: string }) =>
      send<DoctorItem>("/doctors", "POST", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["doctores"] }),
  });
}

export function useEstadoDoctor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      send(`/doctors/${id}`, "PATCH", { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["doctores"] }),
  });
}

export function useAsignarEspecialidad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ doctorId, specialtyId }: { doctorId: string; specialtyId: string }) =>
      send(`/doctors/${doctorId}/specialties`, "POST", { specialtyId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["doctores"] }),
  });
}

export function useRetirarEspecialidad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ doctorId, specialtyId }: { doctorId: string; specialtyId: string }) =>
      send(`/doctors/${doctorId}/specialties/${specialtyId}`, "DELETE"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["doctores"] }),
  });
}
