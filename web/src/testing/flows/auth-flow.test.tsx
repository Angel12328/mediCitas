/**
 * Prueba de flujo completo - specs/web/auth + specs/web/shell
 * Login válido -> redirección al inicio del rol -> cierre de sesión.
 * Compone las piezas reales (página de login, contexto y shell).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { mswServer } from "@/testing/msw-server";
import LoginPage from "@/app/(auth)/login/page";
import {
  SessionProvider,
  type SessionUser,
} from "@/shared/auth/session-context";
import { AppShell } from "@/components/layout/app-shell";

const SESSION_URL = "http://localhost:3000/api/auth/session";

const replace = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const USUARIO: SessionUser = {
  id: "0f0a3d2e-6f1c-4a7e-9b2a-1c2d3e4f5a6b",
  email: "ana@example.com",
  roles: ["PATIENT"],
};

beforeEach(() => {
  replace.mockClear();
  refresh.mockClear();
});

describe("Flujo login -> inicio -> logout", () => {
  it("ejecuta el ciclo completo del spec", async () => {
    // 1) Login con credenciales válidas -> redirección por rol
    mswServer.use(
      http.post(SESSION_URL, () =>
        HttpResponse.json({ user: { id: USUARIO.id, email: USUARIO.email, roles: USUARIO.roles } })
      )
    );
    render(<LoginPage />);
    await userEvent.type(screen.getByLabelText("Correo"), "ana@example.com");
    await userEvent.type(screen.getByLabelText("Contraseña"), "secreto123");
    await userEvent.click(screen.getByTestId("login-enviar"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/inicio"));

    // 2) Sesión establecida: el shell muestra la navegación del rol
    const { unmount } = render(
      <SessionProvider user={USUARIO}>
        <AppShell>
          <p>contenido</p>
        </AppShell>
      </SessionProvider>
    );
    expect(screen.getByTestId("nav-principal")).toHaveTextContent("Inicio");
    expect(screen.getByText(USUARIO.email)).toBeInTheDocument();

    // 3) Cierre de sesión -> vuelve al login
    mswServer.use(
      http.delete(SESSION_URL, () => HttpResponse.json({ ok: true }))
    );
    await userEvent.click(screen.getByTestId("logout-boton"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(refresh).toHaveBeenCalledTimes(2);

    unmount();
  });

  it("SessionProvider hidrata los datos del usuario en el cliente", () => {
    function Consumidor() {
      return null;
    }
    void Consumidor;
    render(
      <SessionProvider user={USUARIO}>
        <AppShell>
          <p>perfil</p>
        </AppShell>
      </SessionProvider>
    );
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
  });
});
