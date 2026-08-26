/**
 * Route Handler de sesión - mediCitas web
 * POST /api/auth/session -> login: valida credenciales contra la API y fija
 *                           cookies httpOnly (access + refresh).
 * DELETE /api/auth/session -> logout: revoca el refresh token en la API y
 *                             limpia las cookies.
 */
import { NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  ACCESS_COOKIE_MAX_AGE,
  API_URL,
  REFRESH_COOKIE,
  REFRESH_COOKIE_MAX_AGE,
  cookieOptions,
} from "@/shared/api/api-client";
import { apiErrorFromResponse } from "@/shared/api/errors";
import { loginSchema, loginResponseSchema } from "@/modules/auth/schemas";

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    raw = null;
  }

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: "Datos inválidos" },
      { status: 400 }
    );
  }

  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(parsed.data),
    cache: "no-store",
  });

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    const problem = apiErrorFromResponse(res.status, body);
    return NextResponse.json(
      { code: problem.code ?? undefined, message: problem.message },
      { status: res.status }
    );
  }

  const session = loginResponseSchema.parse(await res.json());

  const response = NextResponse.json({
    user: session.user,
  });
  response.cookies.set(ACCESS_COOKIE, session.accessToken, cookieOptions(ACCESS_COOKIE_MAX_AGE));
  response.cookies.set(REFRESH_COOKIE, session.refreshToken, cookieOptions(REFRESH_COOKIE_MAX_AGE));
  return response;
}

export async function DELETE(request: Request): Promise<NextResponse> {
  // Revoca el refresh token en la API si está disponible
  const refreshToken = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${REFRESH_COOKIE}=`))
    ?.slice(REFRESH_COOKIE.length + 1);

  if (refreshToken) {
    await fetch(`${API_URL}/api/v1/auth/logout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    }).catch(() => undefined);
  }

  const response = NextResponse.json({ ok: true });
  const cleared = cookieOptions(0);
  response.cookies.set(ACCESS_COOKIE, "", cleared);
  response.cookies.set(REFRESH_COOKIE, "", cleared);
  return response;
}
