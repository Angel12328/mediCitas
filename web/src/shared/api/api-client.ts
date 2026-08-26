/**
 * Cliente HTTP del lado servidor (RSC y Route Handlers) - mediCitas web
 * Adjunta el access token de la cookie, renueva la sesión una vez ante 401
 * y reintenta la petición original (renovación transparente).
 */
import { cookies } from "next/headers";
import { apiErrorFromResponse } from "./errors";

export const API_URL = process.env.API_URL ?? "http://localhost:3000";

export const ACCESS_COOKIE = "mc_at";
export const REFRESH_COOKIE = "mc_rt";

/** Duraciones en segundos (espejan JWT_*_EXPIRES_IN del backend) */
export const ACCESS_COOKIE_MAX_AGE = 60 * 15; // 15 min
export const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 días

const secureCookies = process.env.NODE_ENV === "production";

export interface SessionUser {
  id: string;
  email: string;
  roles: string[];
}

interface ApiFetchOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Token a usar; por defecto se lee de la cookie de acceso */
  accessToken?: string | null;
  /** Desactiva el reintento con renovación (usado internamente) */
  skipRefresh?: boolean;
}

/**
 * Petición tipada contra la API. En Route Handlers puede renovar y persistir
 * cookies nuevas; en RSC el reintento funciona pero la persistencia es
 * best-effort (Next no permite setear cookies durante el render).
 */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { method = "GET", body, skipRefresh = false } = options;

  let token = options.accessToken;
  if (token === undefined) {
    const jar = await cookies();
    token = jar.get(ACCESS_COOKIE)?.value ?? null;
  }

  const doFetch = (accessToken: string | null): Promise<Response> =>
    fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
    });

  let res = await doFetch(token);

  // Renovación transparente: 401 -> refresh -> reintento único
  if (res.status === 401 && !skipRefresh && token !== null) {
    const refreshed = await tryRefresh(token);
    if (refreshed !== null) {
      await persistSession(refreshed);
      res = await doFetch(refreshed.accessToken);
    }
  }

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    throw apiErrorFromResponse(res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

/** Intenta rotar el refresh token; devuelve null si ya no es recuperable */
async function tryRefresh(expiredToken: string): Promise<RefreshResult | null> {
  const jar = await cookies();
  const refreshToken =
    jar.get(REFRESH_COOKIE)?.value ?? expiredToken ?? null;
  if (!refreshToken) return null;

  const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as RefreshResult;
}

/** Persiste la sesión renovada en cookies httpOnly (best-effort en RSC) */
async function persistSession(session: RefreshResult): Promise<void> {
  try {
    const jar = await cookies();
    jar.set(ACCESS_COOKIE, session.accessToken, cookieOptions(ACCESS_COOKIE_MAX_AGE));
    jar.set(REFRESH_COOKIE, session.refreshToken, cookieOptions(REFRESH_COOKIE_MAX_AGE));
  } catch {
    // Render de RSC no permite mutar cookies; el middleware las renovará.
  }
}

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: secureCookies,
    path: "/",
    maxAge,
  };
}
