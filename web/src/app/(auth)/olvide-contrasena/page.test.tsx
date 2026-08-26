/**
 * Pruebas de solicitud de restablecimiento - specs/web/auth/spec.md
 * Confirmación neutra siempre, sin revelar si el correo existe.
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { mswServer } from "@/testing/msw-server";
import ForgotPasswordPage from "./page";

const FORGOT_URL = "http://localhost:3000/api/v1/auth/forgot-password";

describe("Solicitud de restablecimiento", () => {
  it("valida el formato del correo antes de enviar", async () => {
    render(<ForgotPasswordPage />);
    await userEvent.type(screen.getByLabelText("Correo"), "no-es-correo");
    await userEvent.click(screen.getByTestId("olvide-enviar"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /correo válido/i
    );
  });

  it("muestra la confirmación neutra con correo registrado", async () => {
    render(<ForgotPasswordPage />);
    await userEvent.type(screen.getByLabelText("Correo"), "ana@example.com");
    await userEvent.click(screen.getByTestId("olvide-enviar"));

    const confirmacion = await screen.findByTestId("olvide-confirmacion");
    expect(confirmacion).toHaveTextContent(/si el correo está registrado/i);
  });

  it("muestra la MISMA confirmación aunque la petición falle (anti-enumeración)", async () => {
    mswServer.use(http.post(FORGOT_URL, () => HttpResponse.error()));
    render(<ForgotPasswordPage />);
    await userEvent.type(screen.getByLabelText("Correo"), "fantasma@x.com");
    await userEvent.click(screen.getByTestId("olvide-enviar"));

    await waitFor(() =>
      expect(screen.getByTestId("olvide-confirmacion")).toHaveTextContent(
        /si el correo está registrado/i
      )
    );
  });
});
