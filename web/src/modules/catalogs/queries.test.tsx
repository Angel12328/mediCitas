/**
 * Pruebas de hooks de catálogos - specs/web/catalogs/spec.md
 * Reutilización en sesión (sin refetch), dependencia jerárquica y errores.
 */
import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { mswServer } from "@/testing/msw-server";
import { newQueryClient } from "@/testing/test-utils";
import {
  CATALOG_STALE_TIME,
  useCargos,
  useDepartamentos,
  usePaises,
} from "./queries";

const PROXY = "http://localhost:3000/api/proxy";

/** Wrapper con QueryClient aislado por prueba */
function makeWrapper() {
  const client = newQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("Catálogos compartidos", () => {
  it("reutiliza el catálogo de países sin refetch dentro de la sesión", async () => {
    let peticiones = 0;
    mswServer.use(
      http.get(`${PROXY}/countries`, () => {
        peticiones++;
        return HttpResponse.json({
          items: [{ id: "11111111-1111-4111-8111-111111111111", name: "Honduras" }],
          total: 1,
        });
      })
    );

    const wrapper = makeWrapper();
    const primera = renderHook(() => usePaises(), { wrapper });
    await waitFor(() => expect(primera.result.current.isSuccess).toBe(true));

    // Segundo consumidor con el mismo cliente: sirve desde caché
    const segunda = renderHook(() => usePaises(), { wrapper });
    expect(segunda.result.current.data).toBeDefined();
    expect(peticiones).toBe(1);
  });

  it("usa staleTime de 24h (los catálogos apenas cambian)", () => {
    expect(CATALOG_STALE_TIME).toBe(1000 * 60 * 60 * 24);
  });

  it("no consulta departamentos hasta elegir país", async () => {
    let consultas = 0;
    mswServer.use(
      http.get(`${PROXY}/departments`, () => {
        consultas++;
        return HttpResponse.json({
          items: [{ id: "33333333-3333-4333-8333-333333333333", name: "Francisco Morazán" }],
          total: 1,
        });
      })
    );
    const wrapper = makeWrapper();

    const sinPais = renderHook(() => useDepartamentos(undefined), { wrapper });
    expect(sinPais.result.current.fetchStatus).toBe("idle");
    expect(consultas).toBe(0);

    const conPais = renderHook(() => useDepartamentos("11111111-1111-4111-8111-111111111111"), { wrapper });
    await waitFor(() => expect(conPais.result.current.isSuccess).toBe(true));
    expect(conPais.result.current.data?.[0]?.name).toBe("Francisco Morazán");
    expect(consultas).toBe(1);
  });

  it("propaga el título del error del backend ante fallo del catálogo", async () => {
    mswServer.use(
      http.get(`${PROXY}/cargos`, () =>
        HttpResponse.json({ title: "Acceso denegado" }, { status: 403 })
      )
    );
    const hook = renderHook(() => useCargos(), { wrapper: makeWrapper() });
    await waitFor(() => expect(hook.result.current.isError).toBe(true));
    expect((hook.result.current.error as Error).message).toContain(
      "Acceso denegado"
    );
  });
});
