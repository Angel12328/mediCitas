/**
 * Pruebas de datos clínicos - specs/web/profiles/spec.md
 * Validación de tipo de sangre, persistencia y contacto de emergencia.
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { mswServer } from "@/testing/msw-server";
import { newQueryClient } from "@/testing/test-utils";
import { ClinicalData } from "./clinical-data";

const PROXY = "http://localhost:3000/api/proxy";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={newQueryClient()}>{children}</QueryClientProvider>;
}

function setup(inicial?: Partial<Parameters<typeof ClinicalData>[0]>) {
  return render(
    <ClinicalData
      bloodTypeInicial="O_POSITIVE"
      allergiesInicial={null}
      contactoNombre={null}
      contactoNumero={null}
      {...inicial}
    />,
    { wrapper: Wrapper }
  );
}

describe("Datos clínicos del paciente", () => {
  it("muestra el tipo de sangre inicial", () => {
    setup();
    expect(screen.getByLabelText("Tipo de sangre")).toHaveValue("O_POSITIVE");
  });

  it("rechaza guardar sin tipo de sangre válido sin llamar a la API", async () => {
    let llamadas = 0;
    mswServer.use(
      http.patch(`${PROXY}/patients/me`, () => {
        llamadas++;
        return HttpResponse.json({ message: "ok" });
      })
    );
    setup({ bloodTypeInicial: "" });
    await userEvent.click(screen.getByTestId("clinicos-guardar"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /tipo de sangre válido/i
    );
    expect(llamadas).toBe(0);
  });

  it("guarda alergias junto al tipo de sangre (PATCH patients/me)", async () => {
    let cuerpo: Record<string, unknown> | null = null;
    mswServer.use(
      http.patch(`${PROXY}/patients/me`, async ({ request }) => {
        cuerpo = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ message: "Perfil actualizado" });
      })
    );
    setup();
    await userEvent.type(screen.getByLabelText("Alergias"), "Penicilina");
    await userEvent.click(screen.getByTestId("clinicos-guardar"));

    const mensaje = await screen.findByTestId("clinicos-mensaje");
    expect(mensaje).toHaveTextContent(/datos clínicos guardados/i);
    expect(cuerpo).toMatchObject({
      bloodType: "O_POSITIVE",
      allergies: "Penicilina",
    });
  });

  it("guarda el contacto de emergencia en su endpoint propio", async () => {
    let cuerpo: Record<string, unknown> | null = null;
    mswServer.use(
      http.patch(`${PROXY}/patients/me/emergency-contact`, async ({ request }) => {
        cuerpo = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ emergencyContactName: "María" });
      })
    );
    setup();
    await userEvent.type(screen.getByLabelText("Nombre"), "María Pérez");
    await userEvent.type(screen.getByLabelText("Número"), "9999000111");
    await userEvent.click(screen.getByTestId("emergencia-guardar"));

    await waitFor(() =>
      expect(
        screen.getByTestId("clinicos-mensaje")
      ).toHaveTextContent(/emergencia guardado/i)
    );
    expect(cuerpo).toMatchObject({
      emergencyContactName: "María Pérez",
      emergencyContactNumber: "9999000111",
    });
  });

  it("valida el número de emergencia antes de enviar", async () => {
    let llamadas = 0;
    mswServer.use(
      http.patch(`${PROXY}/patients/me/emergency-contact`, () => {
        llamadas++;
        return HttpResponse.json({});
      })
    );
    setup();
    await userEvent.type(screen.getByLabelText("Nombre"), "María");
    await userEvent.type(screen.getByLabelText("Número"), "12");
    await userEvent.click(screen.getByTestId("emergencia-guardar"));

    const alertas = await screen.findAllByRole("alert");
    expect(alertas.some((a) => /mínimo 5 caracteres/i.test(a.textContent ?? ""))).toBe(true);
    expect(llamadas).toBe(0);
  });
});
