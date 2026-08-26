/**
 * Pruebas de restablecimiento con token - specs/web/auth/spec.md
 * Cubre: token inválido, éxito y error del backend con opción de reenviar.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { mswServer } from "@/testing/msw-server";
import ResetPasswordPage from "./page";

const RESET_URL = "http://localhost:3000/api/v1/auth/reset-password";
const TOKEN_VALIDO = "token-de-restablecimiento-suficientemente-largo";

const searchHolder = { value: new URLSearchParams() };
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => searchHolder.value,
}));

function setup(token: string) {
  searchHolder.value = new URLSearchParams(
    token ? `token=${encodeURIComponent(token)}` : ""
  );
  return render(<ResetPasswordPage />);
}

describe("Restablecimiento de contraseña", () => {
  it("informa token inválido cuando falta o es muy corto", () => {
    setup("corto");
    expect(screen.getByTestId("reset-token-invalido")).toHaveTextContent(
      /no es válido o expiró/i
    );
    expect(screen.getByRole("link", { name: /solicitar nuevo enlace/i })).toHaveAttribute(
      "href",
      "/olvide-contrasena"
    );
  });

  it("confirma el cambio con token válido", async () => {
    mswServer.use(http.post(RESET_URL, () => new HttpResponse(null, { status: 204 })));
    setup(TOKEN_VALIDO);

    await userEvent.type(screen.getByLabelText("Nueva contraseña"), "nuevaClave123");
    await userEvent.type(screen.getByLabelText("Confirmar contraseña"), "nuevaClave123");
    await userEvent.click(screen.getByTestId("reset-enviar"));

    await waitFor(() =>
      expect(screen.getByTestId("reset-exito")).toHaveTextContent(/actualizó correctamente/i)
    );
    expect(screen.getByTestId("reset-ir-login")).toHaveAttribute("href", "/login");
  });

  it("rechaza contraseñas que no coinciden sin llamar a la API", async () => {
    let llamadas = 0;
    mswServer.use(
      http.post(RESET_URL, () => {
        llamadas++;
        return new HttpResponse(null, { status: 204 });
      })
    );
    setup(TOKEN_VALIDO);

    await userEvent.type(screen.getByLabelText("Nueva contraseña"), "nuevaClave123");
    await userEvent.type(screen.getByLabelText("Confirmar contraseña"), "distinta456");
    await userEvent.click(screen.getByTestId("reset-enviar"));

    expect(await screen.findByRole("alert")).toHaveTextContent(/no coinciden/i);
    expect(llamadas).toBe(0);
  });

  it("ofrece solicitar nuevo enlace ante token expirado del backend", async () => {
    mswServer.use(
      http.post(RESET_URL, () =>
        HttpResponse.json(
          { title: "Token expirado", status: 422, code: "UNPROCESSABLE" },
          { status: 422 }
        )
      )
    );
    setup(TOKEN_VALIDO);

    await userEvent.type(screen.getByLabelText("Nueva contraseña"), "nuevaClave123");
    await userEvent.type(screen.getByLabelText("Confirmar contraseña"), "nuevaClave123");
    await userEvent.click(screen.getByTestId("reset-enviar"));

    const error = await screen.findByTestId("reset-error");
    expect(error).toHaveTextContent(/no se pudo completar|expirado/i);
    expect(screen.getByText(/solicitar un nuevo enlace/i)).toBeInTheDocument();
  });
});
