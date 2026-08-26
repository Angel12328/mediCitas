/**
 * Pruebas de la pantalla de inicio de sesión - specs/web/auth/spec.md
 * Cubre: campos obligatorios, credenciales inválidas (mensaje genérico) y
 * redirección al inicio según rol ante credenciales válidas.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { mswServer } from "@/testing/msw-server";
import LoginPage from "./page";

const replace = vi.fn();
const refresh = vi.fn();
const searchParamsHolder = { value: new URLSearchParams() };
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh, push: vi.fn() }),
  useSearchParams: () => searchParamsHolder.value,
}));

async function fillAndSubmit(email: string, password: string) {
  await userEvent.type(screen.getByLabelText("Correo"), email);
  await userEvent.type(screen.getByLabelText("Contraseña"), password);
  await userEvent.click(screen.getByTestId("login-enviar"));
}

beforeEach(() => {
  replace.mockClear();
  refresh.mockClear();
  searchParamsHolder.value = new URLSearchParams();
});

const SESSION_URL = "http://localhost:3000/api/auth/session";

const loginOk = http.post(SESSION_URL, () =>
  HttpResponse.json({
    user: {
      id: "0f0a3d2e-6f1c-4a7e-9b2a-1c2d3e4f5a6b",
      email: "ana@example.com",
      roles: ["PATIENT"],
    },
  })
);

describe("Pantalla de inicio de sesión", () => {
  it("muestra errores por campo sin enviar la petición", async () => {
    render(<LoginPage />);
    await userEvent.click(screen.getByTestId("login-enviar"));

    expect(await screen.findAllByRole("alert")).toHaveLength(2);
    expect(screen.queryByTestId("login-error")).not.toBeInTheDocument();
  });

  it("muestra mensaje genérico ante credenciales inválidas", async () => {
    mswServer.use(
      http.post(SESSION_URL, () =>
        HttpResponse.json(
          { code: "UNAUTHORIZED", message: "Correo o contraseña incorrectos" },
          { status: 401 }
        )
      )
    );
    render(<LoginPage />);
    await fillAndSubmit("ana@example.com", "clave-equivocada");

    const error = await screen.findByTestId("login-error");
    expect(error).toHaveTextContent(/incorrectos/i);
  });

  it("redirige al inicio del rol tras credenciales válidas", async () => {
    mswServer.use(loginOk);
    render(<LoginPage />);
    await fillAndSubmit("ana@example.com", "secreto123");

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/inicio"));
    expect(refresh).toHaveBeenCalled();
  });

  it("respeta el parámetro next tras autenticarse", async () => {
    searchParamsHolder.value = new URLSearchParams("next=/mis-citas");
    mswServer.use(loginOk);
    render(<LoginPage />);
    await fillAndSubmit("ana@example.com", "secreto123");

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/mis-citas"));
  });

  it("informa fallo de red sin exponer detalles técnicos", async () => {
    mswServer.use(http.post(SESSION_URL, () => HttpResponse.error()));
    render(<LoginPage />);
    await fillAndSubmit("ana@example.com", "secreto123");

    const error = await screen.findByTestId("login-error");
    expect(error).toHaveTextContent(/No hay conexión/i);
  });
});
