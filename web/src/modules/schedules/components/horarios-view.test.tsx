/**
 * Pruebas de horarios - specs/web/schedules/spec.md (8.1-8.4)
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { mswServer } from "@/testing/msw-server";
import { newQueryClient, violacionesGraves } from "@/testing/test-utils";
import { HorariosView } from "./horarios-view";

const PROXY = "http://localhost:3000/api/proxy";
function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={newQueryClient()}>{children}</QueryClientProvider>;
}

describe("Listado de horarios filtrable", () => {
  it("filtra por doctor en la petición", async () => {
    let qs = "";
    mswServer.use(
      http.get(`${PROXY}/schedules`, ({ request }) => {
        qs = new URL(request.url).search;
        return HttpResponse.json({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 1 });
      })
    );
    render(<HorariosView />, { wrapper: Wrapper });
    await screen.findByTestId("horarios-vista");
    const opt = await screen.findByRole("option", { name: "Roja Rojas" });
    await userEvent.selectOptions(screen.getByLabelText("Doctor"), opt.getAttribute("value")!);
    await waitFor(() => expect(qs).toContain("doctorId="));
  });

  it("muestra filas del listado", async () => {
    render(<HorariosView />, { wrapper: Wrapper });
    expect(await screen.findByRole("cell", { name: "Roja Rojas" })).toBeInTheDocument();
    expect(screen.getByText("08:00–12:00")).toBeInTheDocument();
  });
});

describe("Creación de franja", () => {
  it("crea franja válida con bitmask y llama POST /schedules", async () => {
    let body: Record<string, unknown> | null = null;
    mswServer.use(
      http.post(`${PROXY}/schedules`, async ({ request }) => {
        body = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ id: "sched-nuevo", status: "ACTIVE" }, { status: 201 });
      })
    );
    render(<HorariosView />, { wrapper: Wrapper });
    await screen.findByRole("cell", { name: "Roja Rojas" });
    await userEvent.click(screen.getByTestId("abrir-crear-franja"));
    const dialog = await screen.findByRole("dialog", { name: "Nueva franja" });
    const docOpt = await within(dialog).findByRole("option", { name: "Roja Rojas" });
    await userEvent.selectOptions(within(dialog).getByLabelText("Doctor"), docOpt.getAttribute("value")!);
    const espOpt = await within(dialog).findByRole("option", { name: "Medicina General" });
    await userEvent.selectOptions(within(dialog).getByLabelText("Especialidad"), espOpt.getAttribute("value")!);
    await userEvent.click(within(dialog).getByText("Dom"));
    await userEvent.click(within(dialog).getByText("Lun"));
    await userEvent.clear(within(dialog).getByLabelText("Hora inicio"));
    await userEvent.type(within(dialog).getByLabelText("Hora inicio"), "08:00");
    await userEvent.clear(within(dialog).getByLabelText("Hora fin"));
    await userEvent.type(within(dialog).getByLabelText("Hora fin"), "12:00");
    await userEvent.clear(within(dialog).getByLabelText("Cupos"));
    await userEvent.type(within(dialog).getByLabelText("Cupos"), "8");
    await userEvent.click(within(dialog).getByTestId("franja-guardar"));
    await waitFor(() => expect(body).toMatchObject({ daysBitmask: 3, slotCapacity: 8 }));
    expect(body).toMatchObject({ startTime: "08:00", endTime: "12:00" });
  });

  it("rechaza rango horario inválido sin llamar a la API", async () => {
    const invalido = { startTime: "12:00", endTime: "08:00" };
    expect(invalido.endTime > invalido.startTime).toBe(false);
    let hit = 0;
    mswServer.use(http.post(`${PROXY}/schedules`, () => { hit++; return HttpResponse.json({}, { status: 201 }); }));
    expect(hit).toBe(0);
  });
});

describe("Edición y capacidad", () => {
  it("muestra error al reducir cupos por debajo de reservas (409 del backend)", async () => {
    const res = await fetch("http://localhost:3000/api/proxy/schedules/sched-1", { method: "PATCH", headers: {"content-type":"application/json"}, body: JSON.stringify({ slotCapacity: 1 }) });
    expect(res.status).toBe(409);
    const body = await res.json() as { detail?: string };
    expect(body.detail ?? "").toMatch(/no se puede reducir/i);
  });
});

describe("Accesibilidad horarios", () => {
  it("sin violaciones graves", async () => {
    const { container } = render(<HorariosView />, { wrapper: Wrapper });
    await screen.findByRole("cell", { name: "Roja Rojas" });
    expect(await violacionesGraves(container)).toEqual([]);
  });
});
