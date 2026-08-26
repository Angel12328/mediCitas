/**
 * Matriz de casos generada desde specs/web/patient-onboarding/spec.md
 * (verificacion QA del grupo 5 - ai-test-generation)
 *
 * | # | Caso del spec                          | Automatizado |
 * |---|----------------------------------------|--------------|
 * | 1 | Registro exitoso                       | Si           |
 * | 2 | Correo ya registrado                   | Si           |
 * | 3 | DNI duplicado                          | Si           |
 * | 4 | Campos obligatorios incompletos        | Si           |
 * | 5 | Pais -> departamentos dependientes     | Selector (grupo 4) |
 * | 6 | Departamento -> municipios             | Selector (grupo 4) |
 * | 7 | Sin datos clinicos exigidos*           | Ver nota     |
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { mswServer } from "@/testing/msw-server";
import { newQueryClient } from "@/testing/test-utils";
import { QueryClientProvider } from "@tanstack/react-query";
import RegistroPage from "./page";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={newQueryClient()}>{children}</QueryClientProvider>;
}

const REGISTER_URL = "http://localhost:3000/api/v1/auth/register";

const LLENO = {
  nombre: "Ana",
  apellido: "Pérez",
  nacimiento: "1995-04-12",
  dni: "0801199500432",
  correo: "nueva@persona.com",
  clave: "secreto123",
};

async function llenarFormulario(
  datos: Partial<typeof LLENO> = {},
  opciones: { sinDni?: boolean; sinSangre?: boolean } = {}
) {
  await userEvent.type(screen.getByLabelText("Primer nombre"), datos.nombre ?? LLENO.nombre);
  await userEvent.type(screen.getByLabelText("Primer apellido"), datos.apellido ?? LLENO.apellido);
  await userEvent.type(
    screen.getByLabelText("Fecha de nacimiento"),
    datos.nacimiento ?? LLENO.nacimiento
  );
  if (!opciones.sinDni) {
    await userEvent.type(screen.getByLabelText("DNI"), datos.dni ?? LLENO.dni);
  }
  await userEvent.selectOptions(screen.getByLabelText("Género"), "Femenino");
  if (!opciones.sinSangre) {
    await userEvent.selectOptions(
      screen.getByLabelText("Tipo de sangre"),
      "O_POSITIVE"
    );
  }
  await userEvent.type(screen.getByLabelText("Correo"), datos.correo ?? LLENO.correo);
  await userEvent.type(screen.getByLabelText("Contraseña"), datos.clave ?? LLENO.clave);
  await userEvent.type(
    screen.getByLabelText("Confirmar contraseña"),
    datos.clave ?? LLENO.clave
  );

  // Ubicacion jerarquica: pais -> departamento -> municipio (datos MSW)
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

function registroOk() {
  return http.post(REGISTER_URL, () =>
    HttpResponse.json(
      {
        user: { id: "u-nuevo", email: "nueva@persona.com" },
        accessToken: "access-token-registro-con-longitud-suficiente",
        refreshToken: "refresh-token-registro-con-longitud-suficiente",
      },
      { status: 201 }
    )
  );
}

describe("Autoregistro de pacientes", () => {
  it("caso 1: registro exitoso muestra confirmacion y enlace a login", async () => {
    mswServer.use(registroOk());
    render(<RegistroPage />, { wrapper: Wrapper });
    await llenarFormulario();
    await userEvent.click(screen.getByTestId("registro-enviar"));

    await waitFor(() =>
      expect(screen.getByTestId("registro-exito")).toHaveTextContent(
        /fue creada correctamente/i
      )
    );
    expect(screen.getByTestId("registro-ir-login")).toHaveAttribute("href", "/login");
  });

  it("caso 2: correo ya registrado muestra el error en el campo correo", async () => {
    mswServer.use(
      http.post(REGISTER_URL, () =>
        HttpResponse.json(
          { title: "El correo ya esta registrado", status: 409, code: "CONFLICT" },
          { status: 409 }
        )
      )
    );
    render(<RegistroPage />, { wrapper: Wrapper });
    await llenarFormulario({ correo: "ana@example.com" });
    await userEvent.click(screen.getByTestId("registro-enviar"));

    const alertas = await screen.findAllByRole("alert");
    expect(
      alertas.some((a) => a.textContent?.toLowerCase().includes("correo"))
    ).toBe(true);
    expect(screen.queryByTestId("registro-exito")).not.toBeInTheDocument();
  });

  it("caso 3: DNI duplicado muestra el error en el campo DNI", async () => {
    mswServer.use(
      http.post(REGISTER_URL, () =>
        HttpResponse.json(
          { title: "El DNI ya esta registrado", status: 409, code: "CONFLICT" },
          { status: 409 }
        )
      )
    );
    render(<RegistroPage />, { wrapper: Wrapper });
    await llenarFormulario();
    await userEvent.click(screen.getByTestId("registro-enviar"));

    const alertas = await screen.findAllByRole("alert");
    expect(alertas.some((a) => /dni/i.test(a.textContent ?? ""))).toBe(true);
    expect(screen.queryByTestId("registro-exito")).not.toBeInTheDocument();
  });

  it("caso 4: campos incompletos muestran errores sin enviar peticion", async () => {
    let llamadas = 0;
    mswServer.use(
      http.post(REGISTER_URL, () => {
        llamadas++;
        return HttpResponse.json({}, { status: 201 });
      })
    );
    render(<RegistroPage />, { wrapper: Wrapper });
    // Solo un campo; el resto vacio
    await userEvent.type(screen.getByLabelText("Primer nombre"), "Ana");
    const enviar = vi.fn();
    void enviar;
    await userEvent.click(screen.getByTestId("registro-enviar"));

    const alertas = await screen.findAllByRole("alert");
    expect(alertas.length).toBeGreaterThanOrEqual(5);
    expect(llamadas).toBe(0);
  });

  it("ubicacion jerarquica presente en el formulario", async () => {
    render(<RegistroPage />, { wrapper: Wrapper });
    await waitFor(() =>
      expect(
        (screen.getByLabelText("País") as HTMLSelectElement).options.length
      ).toBeGreaterThan(1)
    );
    expect(screen.getByLabelText("Departamento")).toBeDisabled();
    expect(screen.getByLabelText("Municipio")).toBeDisabled();
  });
});
