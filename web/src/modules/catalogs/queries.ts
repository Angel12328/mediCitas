"use client";

/**
 * Catálogos compartidos - mediCitas web
 * Hooks TanStack Query con staleTime largo: se consultan una vez por sesión
 * y se reutilizan en todos los formularios (specs/web/catalogs/spec.md).
 */
import { useQuery } from "@tanstack/react-query";
import { appUrl } from "@/shared/api/client-url";

/** Los catálogos apenas cambian; 24 h dentro de la sesión */
export const CATALOG_STALE_TIME = 1000 * 60 * 60 * 24;

interface ItemBase {
  id: string;
  name: string;
}

interface PageResponse<T> {
  items: T[];
  total: number;
}

async function fetchCatalog<T extends ItemBase>(path: string): Promise<T[]> {
  const res = await fetch(appUrl(`/api/proxy${path}`), { cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { title?: string } | null;
    throw new Error(body?.title ?? `No se pudo cargar ${path}`);
  }
  const data = (await res.json()) as PageResponse<T> | T[];
  return Array.isArray(data) ? data : data.items;
}

function catalogOptions(path: string) {
  return {
    queryKey: ["catalogo", path],
    queryFn: () => fetchCatalog<ItemBase>(path),
    staleTime: CATALOG_STALE_TIME,
    gcTime: CATALOG_STALE_TIME,
  };
}

export function usePaises() {
  return useQuery(catalogOptions("/countries"));
}

export function useDepartamentos(paisId: string | undefined) {
  return useQuery({
    ...catalogOptions(`/departments?countryId=${paisId ?? ""}`),
    enabled: Boolean(paisId),
  });
}

export function useMunicipios(departamentoId: string | undefined) {
  return useQuery({
    ...catalogOptions(`/municipalities?departmentId=${departamentoId ?? ""}`),
    enabled: Boolean(departamentoId),
  });
}

export function useEspecialidades() {
  return useQuery(catalogOptions("/specialties"));
}

export function useExtensiones() {
  return useQuery(catalogOptions("/extensions"));
}

export function useCargos() {
  return useQuery(catalogOptions("/cargos"));
}
export type CatalogoItem = ItemBase;
