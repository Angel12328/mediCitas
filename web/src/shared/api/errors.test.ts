import { describe, expect, it } from "vitest";
import {
  ApiError,
  apiErrorFromResponse,
  userMessage,
} from "./errors";

describe("mapeo de errores de la API", () => {
  it("convierte un problem+json con código conocido en ApiError", () => {
    const err = apiErrorFromResponse(401, {
      code: "UNAUTHORIZED",
      title: "Correo o contraseña incorrectos",
      status: 401,
    });
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("mapea cada código a su mensaje de usuario", () => {
    const cases = [
      ["VALIDATION_ERROR", "Revisa los datos ingresados."],
      ["UNAUTHORIZED", "Correo o contraseña incorrectos."],
      ["FORBIDDEN", "No tienes permiso para realizar esta acción."],
      ["NOT_FOUND", "No encontramos lo que buscabas."],
      ["CONFLICT", "El recurso ya existe o está en uso."],
      ["UNPROCESSABLE", "No se pudo completar la operación."],
      ["INTERNAL_ERROR", "Ocurrió un error interno. Intenta de nuevo más tarde."],
    ] as const;
    for (const [code, expected] of cases) {
      expect(userMessage(new ApiError(400, code, "titulo"))).toBe(expected);
    }
  });

  it("usa el fallback por estado HTTP ante códigos desconocidos", () => {
    const err = apiErrorFromResponse(429, { title: "Too Many Requests" });
    expect(userMessage(err)).toContain("Demasiados intentos");
  });

  it("usa el título del backend cuando no hay mensaje mapeado", () => {
    const err = apiErrorFromResponse(418, { title: "Soy una tetera" });
    expect(userMessage(err)).toBe("Soy una tetera");
  });

  it("traduce fallos de red a mensaje de conexión", () => {
    expect(userMessage(new TypeError("Failed to fetch"))).toContain(
      "No hay conexión"
    );
  });

  it("tolera cuerpos vacíos o inválidos sin lanzar", () => {
    expect(() => apiErrorFromResponse(500, null)).not.toThrow();
    expect(userMessage(apiErrorFromResponse(500, "texto raro"))).toBeTruthy();
  });
});
