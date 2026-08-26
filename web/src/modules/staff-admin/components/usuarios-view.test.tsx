/**
 * Pruebas de la consola de usuarios - specs/web/staff-admin/spec.md
 * 7.1 filtros combinados y paginación; 7.2 alta con duplicados;
 * 7.3 activar/desactivar; roles asignar/quitar. + axe (7.6)
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { mswServer } from "@/testing/msw-server";
import { newQueryClient, violacionesGraves } from "@/testing/test-utils";
import { UsuariosView } from "./usuarios-view";

const PROXY = "http://localhost:3000/api/proxy";


function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={newQueryClient()}>{children}</QueryClientProvider>;
}

function setup() {
  return render(<UsuariosView />, { wrapper: Wrapper });
}

async function abrirAltaYllenarBasico() {
  await userEvent.click(screen.getByTestId("abrir-alta"));
  await userEvent.type(screen.getByLabelText("Correo"), "nueva@persona.com");
  await userEvent.type(screen.getByLabelText("Contraseña"), "ClaveAdmin123");
  await userEvent.selectOptions(screen.getByLabelText("Tipo de cuenta"), "PATIENT");
  await userEvent.selectOptions(screen.getByLabelText("Tipo de sangre"), "A_POSITIVE");
  await userEvent.type(screen.getByLabelText("Primer nombre"), "Nueva");
  await userEvent.type(screen.getByLabelText("Primer apellido"), "Cuenta");
  await userEvent.type(screen.getByLabelText("Fecha de nacimiento"), "1993-03-03");
  await userEvent.type(screen.getByLabelText("DNI"), "0801199307777");
  await userEvent.selectOptions(screen.getByLabelText("Género"), "Femenino");
  await userEvent.selectOptions(screen.getByLabelText("Rol inicial"), "PATIENT");

  // ubicación jerárquica
  await waitFor(() =>
    expect((screen.getByLabelText("País") as HTMLSelectElement).options.length).toBeGreaterThan(1)
  );
  await userEvent.selectOptions(screen.getByLabelText("País"), "11111111-1111-4111-8111-111111111111");
  await waitFor(() =>
    expect((screen.getByLabelText("Departamento") as HTMLSelectElement).options.length).toBeGreaterThan(1)
  );
  await userEvent.selectOptions(screen.getByLabelText("Departamento"), "33333333-3333-4333-8333-333333333333");
  await waitFor(() =>
    expect((screen.getByLabelText("Municipio") as HTMLSelectElement).options.length).toBeGreaterThan(1)
  );
  await userEvent.selectOptions(screen.getByLabelText("Municipio"), "44444444-4444-4444-8444-444444444444");
}

describe("Listado de usuarios", () => {
  it("renderiza filas del listado paginado", async () => {
    setup();
    expect(await screen.findByTestId("fila-ana@example.com")).toBeInTheDocument();
    expect(screen.getByTestId("pag-siguiente")).toBeDisabled(); // totalPages=1
  });

  it("aplica filtros combinados estado+rol en la petición", async () => {
    let query = "";
    mswServer.use(
      http.get(`${PROXY}/users`, ({ request }) => {
        query = new URL(request.url).search;
        return HttpResponse.json({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 1 });
      })
    );
    setup();
    await screen.findByTestId("usuarios-vista");

    await userEvent.selectOptions(screen.getByLabelText("Estado"), "ACTIVE");
    await userEvent.selectOptions(screen.getByLabelText("Rol"), "PATIENT");

    await waitFor(() => expect(query).toContain("status=ACTIVE"));
    expect(query).toContain("role=PATIENT");
  });

  it("sin violaciones graves de accesibilidad en la tabla", async () => {
    const { container } = setup();
    await screen.findByTestId("fila-ana@example.com");
    const violations = await violacionesGraves(container);
    expect(violations).toEqual([]);
  });
});

describe("Alta manual de cuenta", () => {
  it("crea la cuenta vía POST /users y cierra el diálogo", async () => {
    let cuerpo: Record<string, unknown> | null = null;
    mswServer.use(
      http.post(`${PROXY}/users`, async ({ request }) => {
        cuerpo = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { id: "nuevo-id", email: "nueva@persona.com", status: "ACTIVE", roles: ["PATIENT"], fullName: "N" },
          { status: 201 }
        );
      })
    );
    setup();
    await screen.findByTestId("fila-ana@example.com");
    await abrirAltaYllenarBasico();
    await userEvent.click(screen.getByTestId("alta-enviar"));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Nueva cuenta" })).not.toBeInTheDocument()
    );
    expect(cuerpo).toMatchObject({
      accountType: "PATIENT",
      roleNames: ["PATIENT"],
    });
  });

  it("correo duplicado marca el campo correo sin cerrar el diálogo", async () => {
    setup();
    await screen.findByTestId("fila-ana@example.com");
    await abrirAltaYllenarBasico();
    // El correo duplicado del handler MSW es ana@example.com
    const correo = screen.getByLabelText("Correo");
    await userEvent.clear(correo);
    await userEvent.type(correo, "ana@example.com");
    await userEvent.click(screen.getByTestId("alta-enviar"));

    const alertas = await screen.findAllByRole("alert");
    expect(alertas.some((a) => /correo ya está registrado/i.test(a.textContent ?? ""))).toBe(true);
    expect(screen.getByRole("dialog", { name: "Nueva cuenta" })).toBeInTheDocument();
  });

  it("DNI duplicado marca el campo DNI", async () => {
    setup();
    await screen.findByTestId("fila-ana@example.com");
    await abrirAltaYllenarBasico();
    const dni = screen.getByLabelText("DNI");
    await userEvent.clear(dni);
    await userEvent.type(dni, "9999999999999");
    await userEvent.click(screen.getByTestId("alta-enviar"));

    const alertas = await screen.findAllByRole("alert");
    expect(alertas.some((a) => /DNI ya está registrado/i.test(a.textContent ?? ""))).toBe(true);
  });
});

describe("Activar/desactivar usuarios", () => {
  it("envía PATCH status INACTIVE para un usuario activo", async () => {
    let cuerpo: { status?: string } | null = null;
    mswServer.use(
      http.patch(`${PROXY}/users/:id/status`, async ({ request }) => {
        cuerpo = (await request.json()) as { status: string };
        return HttpResponse.json({ id: "x", status: cuerpo?.status ?? "" });
      })
    );
    setup();
    const fila = await screen.findByTestId("fila-ana@example.com");
    await userEvent.click(within(fila).getByRole("button", { name: "Desactivar" }));

    await waitFor(() => expect(cuerpo?.status).toBe("INACTIVE"));
  });
});

import { within } from "@testing-library/react";

describe("Gestión de roles", () => {
  it("abre el diálogo, asigna y quita roles", async () => {
    let asigno = "";
    let quito = "";
    mswServer.use(
      http.post(`${PROXY}/users/:id/roles`, async ({ request }) => {
        void request;
        asigno = "POST";
        return HttpResponse.json({ roleName: "EMPLOYEE" }, { status: 201 });
      }),
      http.delete(`${PROXY}/users/:id/roles/:roleId`, () => {
        quito = "DELETE";
        return new HttpResponse(null, { status: 204 });
      })
    );

    setup();
    const fila = await screen.findByTestId("fila-rojas@example.com");
    await userEvent.click(within(fila).getByRole("button", { name: "Roles" }));

    const dialogo = await screen.findByRole("dialog", { name: /roles de rojas@example\.com/i });
    expect(dialogo).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("asignar-rol-ADMIN"));
    await waitFor(() => expect(asigno).toBe("POST"));

    await userEvent.click(screen.getByTestId("quitar-rol-DOCTOR"));
    await waitFor(() => expect(quito).toBe("DELETE"));
  });
});
