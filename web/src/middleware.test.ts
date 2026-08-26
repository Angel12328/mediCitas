/**
 * Pruebas de guardas de ruta del middleware - specs/web/shell/spec.md
 * Cubre: rutas públicas/protegidas, redirect por rol, bloqueo por rol
 * insuficiente y renovación transparente de sesión.
 */
import { afterEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { NextRequest } from "next/server";
import { mswServer } from "@/testing/msw-server";
import { middleware } from "./middleware";

const API_URL = process.env.API_URL ?? "http://localhost:3000";

function jwt(payload: Record<string, unknown>): string {
  const b64 = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${b64({ alg: "HS256" })}.${b64(payload)}.firma`;
}

const FUTURO = Math.floor(Date.now() / 1000) + 600;
const PASADO = Math.floor(Date.now() / 1000) - 60;

function request(
  path: string,
  cookies: Record<string, string> = {}
): NextRequest {
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

afterEach(() => mswServer.resetHandlers());

describe("Middleware de acceso", () => {
  it("visitante en ruta privada -> /login conservando el destino", async () => {
    const res = await middleware(request("/inicio"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/login?next=%2Finicio"
    );
  });

  it("visitante en la raíz -> /login", async () => {
    const res = await middleware(request("/"));
    expect(res.headers.get("location")).toContain("/login");
  });

  it("usuario autenticado en ruta pública -> inicio según su rol", async () => {
    const res = await middleware(
      request("/login", { mc_rt: "refresh-valido-1234567890", mc_at: jwt({ sub: "u1", roles: ["PATIENT"], exp: FUTURO }) })
    );
    expect(res.headers.get("location")).toBe("http://localhost:3000/inicio");
  });

  it("ADMIN autenticado que abre /login -> panel de administración", async () => {
    const res = await middleware(
      request("/login", { mc_rt: "refresh-valido-1234567890", mc_at: jwt({ sub: "u2", roles: ["ADMIN"], exp: FUTURO }) })
    );
    expect(res.headers.get("location")).toBe("http://localhost:3000/administracion");
  });

  it("PACIENTE intenta URL administrativa -> acceso denegado sin datos", async () => {
    const res = await middleware(
      request("/administracion", { mc_rt: "refresh-valido-1234567890", mc_at: jwt({ sub: "u1", roles: ["PATIENT"], exp: FUTURO }) })
    );
    expect(res.headers.get("location")).toBe("http://localhost:3000/sin-acceso");
  });

  it("ADMIN con rol suficiente pasa a la ruta administrativa", async () => {
    const res = await middleware(
      request("/administracion", { mc_rt: "refresh-valido-1234567890", mc_at: jwt({ sub: "u2", roles: ["ADMIN"], exp: FUTURO }) })
    );
    // NextResponse.next() no es redirección
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("renueva transparentemente cuando el access token está por expirar", async () => {
    mswServer.use(
      http.post(`${API_URL}/api/v1/auth/refresh`, () =>
        HttpResponse.json({
          accessToken: jwt({ sub: "u1", roles: ["PATIENT"], exp: FUTURO }),
          refreshToken: "refresh-nuevo-rotado-1234567890",
        })
      )
    );
    const res = await middleware(
      request("/inicio", { mc_rt: "refresh-viejo-1234567890", mc_at: jwt({ sub: "u1", roles: ["PATIENT"], exp: PASADO }) })
    );
    expect(res.status).toBe(200);
    const setCookie = res.headers.getSetCookie();
    expect(setCookie.some((c) => c.startsWith("mc_at=") && c.includes("HttpOnly"))).toBe(true);
    expect(setCookie.some((c) => c.startsWith("mc_rt=refresh-nuevo"))).toBe(true);
  });

  it("cierra la sesión cuando el refresh ya no es recuperable", async () => {
    mswServer.use(
      http.post(`${API_URL}/api/v1/auth/refresh`, () =>
        HttpResponse.json({ title: "Token inválido", status: 401 }, { status: 401 })
      )
    );
    const res = await middleware(
      request("/inicio", { mc_rt: "refresh-muerto-1234567890", mc_at: jwt({ sub: "u1", roles: ["PATIENT"], exp: PASADO }) })
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")?.includes("/login")).toBe(true);
    const setCookie = res.headers.getSetCookie();
    expect(setCookie.some((c) => c.startsWith("mc_at=") && c.includes("Max-Age=0"))).toBe(true);
    expect(setCookie.some((c) => c.startsWith("mc_rt=") && c.includes("Max-Age=0"))).toBe(true);
  });
});
