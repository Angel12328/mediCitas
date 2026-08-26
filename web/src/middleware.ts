/**
 * Middleware de acceso - mediCitas web
 * - Rutas públicas: redirigen al inicio si ya hay sesión.
- Rutas privadas: exigen sesión, bloquean por rol insuficiente y renuevan el
  access token de forma transparente cuando está por expirar.
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  decodificarJwt,
  homeForRoles,
  tieneAccesoARuta,
  tokenExpiraPronto,
} from "@/shared/auth/roles";

const ACCESS_COOKIE = "mc_at";
const REFRESH_COOKIE = "mc_rt";

const RUTAS_PUBLICAS = ["/login", "/registro", "/olvide-contrasena", "/restablecer"];

const API_URL = process.env.API_URL ?? "http://localhost:3000";

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

function leerCookie(request: NextRequest, nombre: string): string | undefined {
  return request.cookies.get(nombre)?.value;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = leerCookie(request, ACCESS_COOKIE);
  const refreshToken = leerCookie(request, REFRESH_COOKIE);
  const esPublica =
    RUTAS_PUBLICAS.some((r) => pathname === r || pathname.startsWith(`${r}/`)) ||
    pathname === "/sin-acceso";

  // Visitante en ruta privada -> login conservando destino
  if (!refreshToken && !esPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Sesión activa en ruta pública -> inicio según rol
  if (refreshToken && (esPublica || pathname === "/")) {
    const claims = decodificarJwt(accessToken);
    const url = request.nextUrl.clone();
    url.pathname = homeForRoles(claims?.roles ?? []);
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!refreshToken) return NextResponse.next();

  // Bloqueo por rol insuficiente (el backend es la autoridad final)
  const claims = decodificarJwt(accessToken);
  if (!tieneAccesoARuta(claims?.roles ?? [], pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/sin-acceso";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Renovación transparente del access token próximo a expirar
  if (tokenExpiraPronto(accessToken)) {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) throw new Error("refresh rechazado");
      const tokens = (await res.json()) as { accessToken: string; refreshToken: string };
      const response = NextResponse.next();
      response.cookies.set(ACCESS_COOKIE, tokens.accessToken, cookieOptions(60 * 15));
      response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, cookieOptions(60 * 60 * 24 * 7));
      return response;
    } catch {
      // Sesión no recuperable -> limpiar y mandar a login
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      const respuesta = NextResponse.redirect(url);
      const limpiar = cookieOptions(0);
      respuesta.cookies.set(ACCESS_COOKIE, "", limpiar);
      respuesta.cookies.set(REFRESH_COOKIE, "", limpiar);
      return respuesta;
    }
  }

  return NextResponse.next();
}


export const config = {
  matcher: [
    // Todo excepto recursos internos de Next, la Route Handler de sesión y archivos
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
