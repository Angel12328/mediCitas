/**
 * Verificación QA del grupo 6 (unit-testing) - specs/web/profiles/spec.md
 * Visibilidad por rol: paciente ve datos clínicos; empleado no.
 * Campos de identidad solo lectura.
 */
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";

import { newQueryClient } from "@/testing/test-utils";
import { PerfilContenido } from "./perfil-contenido";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={newQueryClient()}>{children}</QueryClientProvider>;
}

const BASE = {
  id: "u1",
  email: "ana@example.com",
  status: "ACTIVE",
  roles: ["PATIENT"],
  person: {
    id: "p1",
    fullName: "Ana Pérez",
    birthDate: "1995-04-12T00:00:00.000Z",
    dni: "0801199500432",
    gender: "Femenino",
    address: "Calle 1",
  },
};

describe("Vista de perfil por tipo de usuario", () => {
  it("PACIENTE: muestra sección de datos clínicos", () => {
    render(
      <PerfilContenido
        perfil={{
          ...BASE,
          patient: {
            id: "pat-1",
            bloodType: "O_POSITIVE",
            emergencyContactName: null,
            emergencyContactNumber: null,
          },
        }}
      />,
      { wrapper: Wrapper }
    );
    expect(screen.getByTestId("clinicos-card")).toBeInTheDocument();
    expect(screen.getByLabelText("Tipo de sangre")).toBeInTheDocument();
  });

  it("EMPLEADO (MÉDICO/ADMIN/SERVC): no ve datos clínicos", () => {
    render(<PerfilContenido perfil={{ ...BASE, employeeId: "e1" }} />, { wrapper: Wrapper });
    expect(screen.queryByTestId("clinicos-card")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Tipo de sangre")).not.toBeInTheDocument();
  });

  it("DNI y fecha de nacimiento son solo lectura", () => {
    render(<PerfilContenido perfil={BASE} />, { wrapper: Wrapper });
    const zona = within(screen.getByTestId("perfil-solo-lectura"));
    expect(zona.getByText("0801199500432")).toBeInTheDocument();
    expect(zona.getByText(/1995-04-12/)).toBeInTheDocument();
    // No existen inputs para esos campos
    expect(screen.queryByLabelText(/dni \(no editable\)/i)).not.toBeInTheDocument();
  });
});
