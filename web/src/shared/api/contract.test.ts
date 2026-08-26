import { readFileSync } from "node:fs";
/**
 * Verificación QA del grupo 2 - api-testing + service-virtualization
 * Los handlers MSW deben respetar los contratos reales del OpenAPI:
 * los cuerpos simulados pasan por los mismos esquemas Zod que usa la app.
 */
import { describe, expect, it } from "vitest";
import {
  loginResponseSchema,
  refreshResponseSchema,
} from "@/modules/auth/schemas";
import { loginSuccessBody } from "@/testing/msw-server";

describe("Contrato auth entre mocks y esquemas", () => {
  it("el cuerpo de login simulado cumple el esquema LoginResponse", () => {
    expect(() => loginResponseSchema.parse(loginSuccessBody)).not.toThrow();
  });

  it("el cuerpo de refresh simulado cumple el esquema RefreshResponse", () => {
    const body = {
      accessToken: `${loginSuccessBody.accessToken}-rotado`,
      refreshToken: `${loginSuccessBody.refreshToken}-rotado`,
    };
    expect(() => refreshResponseSchema.parse(body)).not.toThrow();
  });

  it("el OpenAPI generado expone las rutas de autenticación usadas por la web", () => {
    const raw = readFileSync("src/shared/api/schema.d.ts", "utf8");
    for (const ruta of ["/api/v1/auth/login", "/auth/refresh", "/users/me"]) {
      expect(raw).toContain(ruta);
    }
  });
});
