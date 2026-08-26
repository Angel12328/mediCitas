/**
 * Pruebas del Route Handler de sesión - mediCitas web
 * Estilo supertest: se invocan los handlers directamente con Request reales.
 */
import { describe, expect, it } from "vitest";
import { DELETE, POST } from "./route";

function jsonRequest(method: "POST" | "DELETE", body?: unknown, cookie?: string) {
  return new Request("http://web.local/api/auth/session", {
    method,
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe("POST /api/auth/session (login)", () => {
  it("fija cookies httpOnly y devuelve el perfil ante credenciales válidas", async () => {
    const res = await POST(
      jsonRequest("POST", { email: "ana@example.com", password: "secreto123" })
    );
    expect(res.status).toBe(200);

    const setCookie = res.headers.getSetCookie();
    const access = setCookie.find((c) => c.startsWith("mc_at="));
    const refresh = setCookie.find((c) => c.startsWith("mc_rt="));
    expect(access).toBeDefined();
    expect(refresh).toBeDefined();
    expect(access).toContain("HttpOnly");
    expect(access?.toLowerCase()).toContain("samesite=lax");
    expect(access?.split("=")[1]?.length).toBeGreaterThan(0); // token presente

    const body = await res.json();
    expect(body.user).toEqual({
      id: expect.any(String),
      email: "ana@example.com",
      roles: ["PATIENT"],
    });
  });

  it("no fija cookies y propaga el 401 con mensaje genérico", async () => {
    const res = await POST(
      jsonRequest("POST", { email: "ana@example.com", password: "mala-clave" })
    );
    expect(res.status).toBe(401);
    expect(res.headers.getSetCookie()).toHaveLength(0);
    const body = await res.json();
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("rechaza con 400 un cuerpo inválido sin llamar a la API", async () => {
    const res = await POST(jsonRequest("POST", { email: "no-es-correo" }));
    expect(res.status).toBe(400);
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });
});

describe("DELETE /api/auth/session (logout)", () => {
  it("revoca el refresh token en la API y limpia las cookies", async () => {
    const res = await DELETE(
      jsonRequest("DELETE", undefined, "mc_rt=refresh-token-de-prueba-con-longitud-suficiente")
    );
    expect(res.status).toBe(200);

    const setCookie = res.headers.getSetCookie();
    const access = setCookie.find((c) => c.startsWith("mc_at="));
    const refresh = setCookie.find((c) => c.startsWith("mc_rt="));
    expect(access).toContain("Max-Age=0");
    expect(refresh).toContain("Max-Age=0");
  });

  it("limpia cookies incluso sin refresh token presente", async () => {
    const res = await DELETE(jsonRequest("DELETE"));
    expect(res.status).toBe(200);
    expect(res.headers.getSetCookie().length).toBeGreaterThanOrEqual(2);
  });
});
