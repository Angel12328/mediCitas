/**
 * Pruebas de renovación transparente de sesión - mediCitas web
 * Camino feliz: 401 -> refresh -> reintento exitoso.
 * Camino de fallo: refresh rechazado -> ApiError 401 (sin reintento infinito).
 */
import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { PERFIL_USUARIO, mswServer } from "@/testing/msw-server";
import { ACCESS_COOKIE, API_URL, REFRESH_COOKIE, apiFetch } from "./api-client";

// Sustituye next/headers por un tarro de cookies mutable en memoria
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      jar.has(name) ? { name, value: jar.get(name)! } : undefined,
    set: (name: string, value: string) => {
      jar.set(name, value);
    },
    delete: (name: string) => {
      jar.delete(name);
    },
  }),
}));

const TOKEN_VIEJO = "access-token-viejo-con-longitud-suficiente";
const REFRESCO_VALIDO = "refresh-token-de-prueba-con-longitud-suficiente";
const PERFIL = PERFIL_USUARIO;

describe("apiFetch con renovación transparente", () => {
  it("renueva el access token ante 401 y reintenta una sola vez", async () => {
    jar.set(ACCESS_COOKIE, TOKEN_VIEJO);
    jar.set(REFRESH_COOKIE, REFRESCO_VALIDO);

    let refreshCalls = 0;
    mswServer.use(
      http.post(`${API_URL}/api/v1/auth/refresh`, async () => {
        refreshCalls++;
        return HttpResponse.json({
          accessToken: `${TOKEN_VIEJO}-rotado`,
          refreshToken: `${REFRESCO_VALIDO}-rotado`,
        });
      })
    );

    const perfil = await apiFetch<typeof PERFIL>("/api/v1/users/me");
    expect(perfil).toEqual(PERFIL);
    expect(refreshCalls).toBe(1);
    // Las cookies quedaron actualizadas con los tokens rotados
    expect(jar.get(ACCESS_COOKIE)).toContain("-rotado");
    expect(jar.get(REFRESH_COOKIE)).toContain("-rotado");
  });

  it("propaga 401 cuando el refresh ya no es recuperable", async () => {
    jar.set(ACCESS_COOKIE, TOKEN_VIEJO);
    jar.set(REFRESH_COOKIE, "refresh-invalido-que-falla-en-la-api");

    await expect(apiFetch("/api/v1/users/me")).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
    });
  });

  it("con skipRefresh no intenta renovar", async () => {
    jar.set(ACCESS_COOKIE, TOKEN_VIEJO);
    jar.clear();
    jar.set(ACCESS_COOKIE, TOKEN_VIEJO);

    await expect(
      apiFetch("/api/v1/users/me", { accessToken: TOKEN_VIEJO, skipRefresh: true })
    ).rejects.toMatchObject({ status: 401 });
  });
});
