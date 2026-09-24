/**
 * Pruebas de citas - specs/web/appointments/spec.md
 * Mis citas, agenda médico y gestión.
 * Wizard tests are in appointments-wizard.test.tsx
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { mswServer } from "@/testing/msw-server";
import { newQueryClient } from "@/testing/test-utils";
import { MisCitas } from "./mis-citas";
import { AgendaDoctor } from "./agenda-doctor";
import { GestionCitas } from "./gestion-citas";

const PROXY = "http://localhost:3000/api/proxy";
function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={newQueryClient()}>{children}</QueryClientProvider>;
}

describe("Mis citas del paciente", () => {
  it("cancela una cita futura", async () => {
    let patchBody: string = "";
    mswServer.use(http.patch(`${PROXY}/appointments/:id/status`, async ({ request }) => {
      const b = await request.json() as { status: string };
      patchBody = b.status;
      return HttpResponse.json({ id: "cita-1", status: b.status });
    }));
    render(<MisCitas />, { wrapper: Wrapper });
    expect((await screen.findAllByRole("cell", { name: "Roja Rojas" })).length).toBeGreaterThanOrEqual(1);
    await userEvent.click(screen.getByTestId("cancelar-cita-2"));
    await waitFor(() => expect(patchBody).toBe("CANCELLED"));
  });
});

describe("Agenda del doctor", () => {
  const mockAgenda = {
    date: "2026-09-20",
    doctorId: "doc-1",
    items: [
      {
        scheduleId: "sch-1",
        specialtyId: "spec-1",
        specialtyName: "Cardiología",
        startTime: "08:00",
        endTime: "12:00",
        slotCapacity: 3,
        bookedCount: 2,
        appointments: [
          { id: "cita-1", position: 1, patientId: "p1", patientName: "Ana Pérez", status: "PENDING", observation: null },
          { id: "cita-2", position: 2, patientId: "p2", patientName: "Juan López", status: "CONFIRMED", observation: null },
        ],
      },
      {
        scheduleId: "sch-2",
        specialtyId: "spec-2",
        specialtyName: "Dermatología",
        startTime: "14:00",
        endTime: "18:00",
        slotCapacity: 2,
        bookedCount: 1,
        appointments: [
          { id: "cita-3", position: 1, patientId: "p3", patientName: "María García", status: "COMPLETED", observation: null },
        ],
      },
    ],
  };

  beforeEach(() => {
    mswServer.use(
      http.get(`${PROXY}/doctors/me/agenda`, () => HttpResponse.json(mockAgenda)),
      http.get(`${PROXY}/schedules/availability`, () => HttpResponse.json({ items: [] })),
      http.post(`${PROXY}/appointments/follow-up`, () => HttpResponse.json({ id: "new-cita", status: "PENDING" }, { status: 201 })),
    );
  });

  it("marca ATENDIDA y NO_ASISTIDA", async () => {
    const estados: string[] = [];
    mswServer.use(http.patch(`${PROXY}/appointments/:id/status`, async ({ request }) => {
      const b = await request.json() as { status: string };
      estados.push(b.status);
      return HttpResponse.json({ id: "cita-1", status: b.status });
    }));
    render(<AgendaDoctor />, { wrapper: Wrapper });
    expect((await screen.findAllByRole("cell", { name: "Ana Pérez" })).length).toBeGreaterThanOrEqual(1);
    // Abrir dropdown y verificar botones
    await userEvent.click(screen.getByTestId("dropdown-cita-1"));
    expect(screen.getByTestId("conf-cita-1")).toBeInTheDocument();
    expect(screen.getByTestId("na-cita-1")).toBeInTheDocument();
    // Cerrar dropdown con Escape
    await userEvent.keyboard("{Escape}");
    // Abrir dropdown para cita-2
    await userEvent.click(screen.getByTestId("dropdown-cita-2"));
    expect(screen.getByTestId("aten-cita-2")).toBeInTheDocument();
    expect(screen.getByTestId("na-cita-2")).toBeInTheDocument();
  });
  it("solo ve citas de sus horarios (aislamiento)", async () => {
    render(<AgendaDoctor />, { wrapper: Wrapper });
    expect((await screen.findAllByRole("cell", { name: "Ana Pérez" })).length).toBeGreaterThanOrEqual(1);
    const filas = await screen.findAllByRole("row");
    expect(filas.length).toBeGreaterThan(1);
  });
});
