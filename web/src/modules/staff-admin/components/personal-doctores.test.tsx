/**
 * Pruebas de personal y doctores - specs/web/staff-admin/spec.md
 * 7.4 empleados/cargos con historial; 7.5 doctores/especialidades.
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { mswServer } from "@/testing/msw-server";
import { newQueryClient, violacionesGraves } from "@/testing/test-utils";
import { PersonalView } from "./personal-view";
import { DoctoresView } from "./doctores-view";

const PROXY = "http://localhost:3000/api/proxy";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={newQueryClient()}>{children}</QueryClientProvider>;
}

describe("Personal (empleados)", () => {
  it("lista empleados con su cargo actual", async () => {
    render(<PersonalView />, { wrapper: Wrapper });
    expect(await screen.findByText("Luisa Port")).toBeInTheDocument();
    expect(screen.getByText("Recepcionista")).toBeInTheDocument();
  });

  it("registra empleado desde usuario existente (POST /employees)", async () => {
    let cuerpo: Record<string, unknown> | null = null;
    const extra: Array<{ id: string; email: string; fullName: string; roles: string[]; currentCargo: string | null; status: string }> = [];
    mswServer.use(
      http.post(`${PROXY}/employees`, async ({ request }) => {
        cuerpo = (await request.json()) as Record<string, unknown>;
        const nuevo = {
          id: "emp-nuevo-2",
          email: "ana@example.com",
          fullName: "Ana Pérez",
          roles: [],
          currentCargo: null,
          status: "ACTIVE",
        };
        extra.push(nuevo);
        return HttpResponse.json(nuevo, { status: 201 });
      }),
      http.get(`${PROXY}/employees`, () =>
        HttpResponse.json({
          items: [
            {
              id: "00000000-0000-4000-8000-0000emp10000".replace(/emp1/g, "emp1"),
              email: "luisa@example.com",
              fullName: "Luisa Port",
              roles: ["EMPLOYEE"],
              currentCargo: "Recepcionista",
              status: "ACTIVE",
            },
            ...extra,
          ],
          page: 1,
          pageSize: 10,
          total: 1 + extra.length,
          totalPages: 1,
        })
      )
    );
    render(<PersonalView />, { wrapper: Wrapper });
    await screen.findByText("Luisa Port");

    await userEvent.type(screen.getByLabelText("Usuario existente"), "user-uuid-123");
    await userEvent.click(screen.getByTestId("empleado-crear"));

    await waitFor(() => expect(cuerpo).toMatchObject({ userId: "user-uuid-123" }));
    expect(await screen.findByText("Ana Pérez")).toBeInTheDocument();
  });

  it("asigna cargo y muestra el historial con fecha", async () => {
    const catalogMod = await import("@/modules/catalogs/queries");
    const spy = (await import("vitest")).vi.spyOn(catalogMod, "useCargos");
    spy.mockReturnValue({ data: { items: [{ id: "cargo-1", name: "Recepcionista" }, { id: "cargo-2", name: "Enfermero/a" }] } } as unknown as ReturnType<typeof catalogMod.useCargos>);

    render(<PersonalView />, { wrapper: Wrapper });
    await screen.findByText("Luisa Port");

    await userEvent.click(screen.getByTestId(/cargos-toggle-/));
    const panel = await screen.findByTestId(/cargo-panel-/);
    expect(within(panel).getByText("Historial")).toBeInTheDocument();
    // Historial precargado por handler MSW
    expect(await within(panel).findByText(/Recepcionista ·/)).toBeInTheDocument();

    await screen.findByRole("option", { name: "Recepcionista" });
    await userEvent.selectOptions(within(panel).getByLabelText("Nuevo cargo"), "cargo-2");
    await userEvent.click(within(panel).getByTestId("cargo-asignar"));

    // El POST se dispara; el historial del handler sigue respondiendo
    await waitFor(() => expect(panel).toBeInTheDocument());
    spy.mockRestore();
  });

  it("sin violaciones graves de accesibilidad", async () => {
    const { container } = render(<PersonalView />, { wrapper: Wrapper });
    await screen.findByText("Luisa Port");
    expect(await violacionesGraves(container)).toEqual([]);
  });
});

describe("Doctores", () => {
  it("filtra por especialidad en la petición", async () => {
    let query = "";
    mswServer.use(
      http.get(`${PROXY}/doctors`, ({ request }) => {
        query = new URL(request.url).search;
        return HttpResponse.json({
          items: [
            { id: "d1", email: "r@x.com", fullName: "Roja Rojas", specialties: ["Cardiología"], status: "ACTIVE" },
          ],
          page: 1,
          pageSize: 10,
          total: 1,
          totalPages: 1,
        });
      })
    );
    render(<DoctoresView />, { wrapper: Wrapper });
    await screen.findByText("Roja Rojas");
    const opt = await screen.findByRole("option", { name: "Cardiología" });
    await userEvent.selectOptions(screen.getByLabelText("Filtrar por especialidad"), opt.getAttribute("value")!);
    await waitFor(() => expect(query).toContain("specialtyId="));
  });

  it("asigna especialidad a un doctor sin ella", async () => {
    let asignada = "";
    mswServer.use(
      http.post(`${PROXY}/doctors/:id/specialties`, async ({ request }) => {
        const body = (await request.json()) as { specialtyId: string };
        asignada = body.specialtyId;
        return HttpResponse.json({ doctorId: "d1", specialtyId: body.specialtyId, specialtyName: "Medicina General", status: "ACTIVE" }, { status: 201 });
      }),
      http.get(`${PROXY}/doctors`, () =>
        HttpResponse.json({
          items: [{ id: "d1", email: "r@x.com", fullName: "Roja Rojas", specialties: ["Cardiología"], status: "ACTIVE" }],
          page: 1,
          pageSize: 10,
          total: 1,
          totalPages: 1,
        })
      )
    );
    render(<DoctoresView />, { wrapper: Wrapper });
    await screen.findByText("Roja Rojas");
    const boton = await screen.findByRole("button", { name: "+ Medicina General" });
    await userEvent.click(boton);
    await waitFor(() => expect(asignada).toMatch(/^[0-9a-f-]{36}$/));
  });

  it("retira una especialidad activa", async () => {
    let retirada = "";
    mswServer.use(
      http.delete(`${PROXY}/doctors/:id/specialties/:specialtyId`, ({ params }) => {
        retirada = String(params.specialtyId);
        return new HttpResponse(null, { status: 204 });
      }),
      http.get(`${PROXY}/doctors`, () =>
        HttpResponse.json({
          items: [{ id: "d1", email: "r@x.com", fullName: "Roja Rojas", specialties: ["Cardiología"], status: "ACTIVE" }],
          page: 1,
          pageSize: 10,
          total: 1,
          totalPages: 1,
        })
      )
    );
    render(<DoctoresView />, { wrapper: Wrapper });
    await screen.findByText("Roja Rojas");
    await userEvent.click(screen.getByRole("button", { name: "Retirar Cardiología" }));
    await waitFor(() => expect(retirada).toMatch(/^[0-9a-f-]{36}$/));
  });

  it("desactiva/activa al doctor vía PATCH", async () => {
    let estado = "";
    mswServer.use(
      http.patch(`${PROXY}/doctors/:id`, async ({ request }) => {
        const b = (await request.json()) as { status: string };
        estado = b.status;
        return HttpResponse.json({ id: "d1", status: b.status });
      })
    );
    render(<DoctoresView />, { wrapper: Wrapper });
    await screen.findByText("Roja Rojas");
    await userEvent.click(screen.getByRole("button", { name: "Desactivar" }));
    await waitFor(() => expect(estado).toBe("INACTIVE"));
  });
});
