/**
 * Proxy autenticado genérico - mediCitas web
 * El navegador no tiene el access token (cookies httpOnly); este Route Handler
 * reenvía la petición a la API adjuntando la sesión del usuario y aplicando
 * renovación transparente. GET/POST/PUT/PATCH/DELETE /api/proxy/<ruta API>.
 */
import { NextResponse } from "next/server";
import { apiFetch } from "@/shared/api/api-client";
import { ApiError } from "@/shared/api/errors";

type Ctx = { params: Promise<{ path: string[] }> };

async function forward(request: Request, ctx: Ctx): Promise<NextResponse> {
  const { path } = await ctx.params;
  const method = request.method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  const search = new URL(request.url).search;

  let body: unknown;
  if (!["GET", "DELETE"].includes(method)) {
    body = await request.json().catch(() => undefined);
  }

  try {
    const data = await apiFetch(`/api/v1/${path.join("/")}${search}`, {
      method,
      ...(body !== undefined ? { body } : {}),
    });
    if (data === undefined) return new NextResponse(null, { status: 204 });
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { code: err.code, title: err.message, status: err.status },
        { status: err.status }
      );
    }
    return NextResponse.json({ title: "Error inesperado", status: 500 }, { status: 500 });
  }
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
