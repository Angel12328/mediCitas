/**
 * Pruebas del shell autenticado - specs/web/shell/spec.md
 * Navegación diferenciada por los cuatro roles, combinación multi-rol,
 * bloqueo visual de módulos pendientes y cierre de sesión.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { mswServer } from "@/testing/msw-server";
import { SessionProvider, type SessionUser } from "@/shared/auth/session-context";
import { AppShell } from "./app-shell";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
}));

function renderConSesion(user: SessionUser) {
  return render(
    <SessionProvider user={user}>
      <AppShell>
        <p>contenido</p>
      </AppShell>
    </SessionProvider>
  );
}

const usuarios: Record<string, SessionUser> = {
  paciente: { id: "u1", email: "ana@x.com", roles: ["PATIENT"] },
  doctor: { id: "u2", email: "rojas@x.com", roles: ["DOCTOR"] },
  admin: { id: "u3", email: "admin@x.com", roles: ["ADMIN"] },
  servc: { id: "u4", email: "luisa@x.com", roles: ["EMPLOYEE"] },
  multiple: { id: "u5", email: "multi@x.com", roles: ["ADMIN", "PATIENT"] },
};

beforeEach(() => {
  replace.mockClear();
});

describe("Navegación según rol", () => {
  it("PACIENTE: inicio, agendar, mis citas y perfil; sin panel admin", () => {
    renderConSesion(usuarios.paciente);
    const nav = screen.getByTestId("nav-principal");
    expect(nav).toHaveTextContent("Inicio");
    expect(nav).toHaveTextContent("Agendar cita");
    expect(nav).toHaveTextContent("Mis citas");
    expect(nav).toHaveTextContent("Mi perfil");
    expect(nav).not.toHaveTextContent("Panel de administración");
  });

  it("MÉDICO: agenda del día y mis citas", () => {
    renderConSesion(usuarios.doctor);
    const nav = screen.getByTestId("nav-principal");
    expect(nav).toHaveTextContent("Agenda del día");
    expect(nav).toHaveTextContent("Mis citas");
    expect(nav).not.toHaveTextContent("Panel de administración");
  });

  it("ADMIN: panel de administración disponible", () => {
    renderConSesion(usuarios.admin);
    const link = screen.getByRole("link", { name: "Panel de administración" });
    expect(link).toHaveAttribute("href", "/administracion");
  });

  it("SERVICIO AL CLIENTE: gestión de citas disponible", () => {
    renderConSesion(usuarios.servc);
    expect(
      screen.getByRole("link", { name: "Gestión de citas" })
    ).toHaveAttribute("href", "/gestion-citas");
  });

  it("usuario con varios roles combina opciones sin duplicados", () => {
    renderConSesion(usuarios.multiple);
    const nav = screen.getByTestId("nav-principal");
    expect(nav).toHaveTextContent("Panel de administración");
    expect(nav).toHaveTextContent("Agendar cita");
    expect(screen.getAllByText("Inicio")).toHaveLength(1);
  });

  it("navegación habilitada para módulos implementados", () => {
    renderConSesion(usuarios.paciente);
    const link = screen.getByRole("link", { name: "Agendar cita" });
    expect(link).toHaveAttribute("href", "/citas/agendar");
    expect(screen.getByRole("link", { name: "Mis citas" })).toHaveAttribute("href", "/mis-citas");
  });
});

describe("Cierre de sesión", () => {
  it("llama al endpoint de sesión y redirige a /login", async () => {
    let deleteLlamado = false;
    mswServer.use(
      http.delete("http://localhost:3000/api/auth/session", () => {
        deleteLlamado = true;
        return HttpResponse.json({ ok: true });
      })
    );

    renderConSesion(usuarios.paciente);
    await userEvent.click(screen.getByTestId("logout-boton"));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(deleteLlamado).toBe(true);
  });
});
