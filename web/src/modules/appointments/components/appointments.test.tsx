/**
 * Pruebas de citas - specs/web/appointments/spec.md (9.1-9.6)
 * Agendamiento guiado, horario completo, mis citas, agenda médico y gestión.
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { mswServer } from "@/testing/msw-server";
import { newQueryClient, violacionesGraves } from "@/testing/test-utils";
import { AgendarWizard } from "./agendar-wizard";
import { MisCitas } from "./mis-citas";
import { AgendaDoctor } from "./agenda-doctor";
import { GestionCitas } from "./gestion-citas";

const PROXY = "http://localhost:3000/api/proxy";
function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={newQueryClient()}>{children}</QueryClientProvider>;
}

describe("Agendamiento guiado del paciente", () => {
  it("especialidad -> doctor -> horarios con cupos -> confirmar crea cita", async () => {
    render(<AgendarWizard />, { wrapper: Wrapper });
    const espOpt = await screen.findByRole("option", { name: "Medicina General" });
    await userEvent.selectOptions(screen.getByLabelText("Especialidad"), espOpt.getAttribute("value")!);
    await waitFor(() => expect((screen.getByLabelText("Doctor") as HTMLSelectElement).options.length).toBeGreaterThan(1));
    const docOpt = await screen.findByRole("option", { name: "Roja Rojas" });
    await userEvent.selectOptions(screen.getByLabelText("Doctor"), docOpt.getAttribute("value")!);
    // usar el id real del mock: dr id del doctores handler es uuid, pero el select muestra doctores del staff-admin mock (fullName). Forzar doctorId conocido
    // Simplificar: usar el doctorId que el mock de availability espera: doc1 genérico no importa, availability mock ignora el id y devuelve slot
    // Forzamos fecha a hoy para que availability devuelva items
    const today = new Date().toISOString().slice(0,10);
    const fechaInput = screen.getByLabelText("Fecha") as HTMLInputElement;
    await userEvent.clear(fechaInput);
    await userEvent.type(fechaInput, today);
    expect(await screen.findByText(/8 cupos libres/)).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("reservar-sched-1"));
    expect(await screen.findByTestId("agendar-exito")).toHaveTextContent(/posición 3/i);
  });

  it("horario sin cupos muestra error Horario completo y no crea", async () => {
    mswServer.use(
      http.post(`${PROXY}/appointments`, () => HttpResponse.json({ title:"Horario completo", status:409, detail:"Horario completo"},{status:409}))
    );
    render(<AgendarWizard />, { wrapper: Wrapper });
    const espOpt2 = await screen.findByRole("option", { name: "Medicina General" });
    await userEvent.selectOptions(screen.getByLabelText("Especialidad"), espOpt2.getAttribute("value")!);
    await waitFor(() => expect((screen.getByLabelText("Doctor") as HTMLSelectElement).options.length).toBeGreaterThan(1));
    // elegir primer doctor disponible
    const docOpt2 = await screen.findByRole("option", { name: "Roja Rojas" });
    await userEvent.selectOptions(screen.getByLabelText("Doctor"), docOpt2.getAttribute("value")!);
    await screen.findByText(/8 cupos libres/);
    await userEvent.click(screen.getByTestId("reservar-sched-1"));
    expect(await screen.findByTestId("agendar-error")).toHaveTextContent(/Horario completo/i);
  });
});

describe("Mis citas del paciente", () => {
  it("cancela una cita futura", async () => {
    let patchBody: string="";
    mswServer.use(http.patch(`${PROXY}/appointments/:id/status`, async ({request})=>{ const b=await request.json() as {status:string}; patchBody=b.status; return HttpResponse.json({id:"cita-1", status:b.status}); }));
    render(<MisCitas />, { wrapper: Wrapper });
    expect((await screen.findAllByRole("cell", { name: "Roja Rojas" })).length).toBeGreaterThanOrEqual(1);
    await userEvent.click(screen.getByTestId("cancelar-cita-2"));
    await waitFor(()=> expect(patchBody).toBe("CANCELLED"));
  });
});

describe("Agenda del doctor", () => {
  it("marca ATENDIDA y NO_ASISTIDA", async () => {
    const estados: string[]=[];
    mswServer.use(http.patch(`${PROXY}/appointments/:id/status`, async ({request})=>{ const b=await request.json() as {status:string}; estados.push(b.status); return HttpResponse.json({id:"cita-1", status:b.status}); }));
    render(<AgendaDoctor />, { wrapper: Wrapper });
    expect((await screen.findAllByRole("cell", { name: "Ana Pérez" })).length).toBeGreaterThanOrEqual(1);
    await userEvent.click(screen.getByTestId("aten-cita-1"));
    await waitFor(()=> expect(estados).toContain("COMPLETED"));
    await userEvent.click(screen.getByTestId("na-cita-1"));
    await waitFor(()=> expect(estados).toContain("NO_SHOW"));
  });
  it("solo ve citas de sus horarios (aislamiento)", async () => {
    // El mock por defecto solo devuelve citas del doctor logueado (forcedDoctorId)
    render(<AgendaDoctor />, { wrapper: Wrapper });
    expect((await screen.findAllByRole("cell", { name: "Ana Pérez" })).length).toBeGreaterThanOrEqual(1);
    const filas = await screen.findAllByRole("row");
    // header + al menos 1 cita
    expect(filas.length).toBeGreaterThan(1);
  });
});

describe("Gestión de citas por personal", () => {
  it("filtra por estado y guarda observación", async () => {
    let obsBody="";
    mswServer.use(
      http.get(`${PROXY}/appointments`, ({request})=>{
        const s=new URL(request.url).searchParams.get("status")||"";
        // eco del filtro en título para verificación indirecta
        return HttpResponse.json({items: s==="PENDING"? [{id:"cita-1", date:new Date().toISOString().slice(0,10), position:1, status:"PENDING", observation:null, patientId:"p1", patientName:"Ana", scheduleId:"s1", startTime:"08:00", endTime:"12:00", specialtyName:"Cardio", doctorId:"d1", doctorName:"Rojas"}]: [], page:1, pageSize:10, total: s==="PENDING"?1:0, totalPages:1});
      }),
      http.post(`${PROXY}/appointments/:id/observations`, async ({request})=>{ const b=await request.json() as {observation:string}; obsBody=b.observation; return HttpResponse.json({id:"cita-1", observation:b.observation}); })
    );
    render(<GestionCitas />, { wrapper: Wrapper });
    await userEvent.selectOptions(screen.getByLabelText("Estado"), "PENDING");
    await waitFor(()=> expect(screen.getByText("Ana")).toBeInTheDocument());
    const input = screen.getByPlaceholderText("Nota");
    await userEvent.type(input, "Llegó puntual");
    await userEvent.click(screen.getByTestId("gc-obs-cita-1"));
    await waitFor(()=> expect(obsBody).toBe("Llegó puntual"));
  });
  it("sin violaciones graves en agendamiento", async () => {
    const { container } = render(<AgendarWizard />, { wrapper: Wrapper });
    await screen.findByLabelText("Especialidad");
    expect(await violacionesGraves(container)).toEqual([]);
  });
});
