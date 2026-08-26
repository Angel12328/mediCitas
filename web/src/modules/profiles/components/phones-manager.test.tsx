/**
 * Pruebas de gestión de teléfonos - specs/web/profiles/spec.md
 * Listar, agregar (persistencia vía mock) y quitar con confirmación.
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { mswServer, PERFIL_USUARIO } from "@/testing/msw-server";
import { newQueryClient } from "@/testing/test-utils";
import { PhonesManager } from "./phones-manager";

const PROXY = "http://localhost:3000/api/proxy";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={newQueryClient()}>{children}</QueryClientProvider>;
}

function setup() {
  return render(<PhonesManager personId={PERFIL_USUARIO.id} />, { wrapper: Wrapper });
}

describe("Gestión de teléfonos", () => {
  it("lista los teléfonos existentes", async () => {
    setup();
    // El número vive en su propio span dentro del ítem
    expect(await screen.findByText("9999112233")).toBeInTheDocument();
    expect(screen.getByText("Móvil")).toBeInTheDocument();
  });

  it("muestra estado vacío cuando no hay teléfonos", async () => {
    mswServer.use(
      http.get(`${PROXY}/phones`, () => HttpResponse.json({ items: [] }))
    );
    setup();
    expect(
      await screen.findByText(/no tienes teléfonos registrados/i)
    ).toBeInTheDocument();
  });

  it("agrega un teléfono válido y refresca la lista", async () => {
    const agregados: Array<{ id: string; number: string; extensionName: string }> = [];
    let postBody: Record<string, unknown> | null = null;
    mswServer.use(
      http.post(`${PROXY}/phones`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown> & { number: string };
        postBody = body;
        const nuevo = {
          id: `tel-x-${agregados.length + 1}`,
          number: body.number,
          extensionName: "Casa",
        };
        agregados.push(nuevo);
        return HttpResponse.json(nuevo, { status: 201 });
      }),
      http.get(`${PROXY}/phones`, () =>
        HttpResponse.json({
          items: [
            { id: "tel-1", number: "9999112233", extensionName: "Móvil" },
            ...agregados,
          ],
        })
      )
    );
    setup();
    await screen.findByText("9999112233");

    await userEvent.type(screen.getByLabelText("Número"), "9876543210");
    await userEvent.selectOptions(screen.getByLabelText("Extensión"), "66666666-6666-4666-8666-666666666666");
    await userEvent.click(screen.getByTestId("telefono-agregar"));

    await screen.findByText("9876543210");
    // El POST incluyó el personId del perfil (contrato real del backend)
    expect(postBody).toMatchObject({
      number: "9876543210",
      personId: PERFIL_USUARIO.id,
    });
  });

  it("valida el número sin enviar la petición", async () => {
    let llamadas = 0;
    mswServer.use(
      http.post(`${PROXY}/phones`, () => {
        llamadas++;
        return HttpResponse.json({}, { status: 201 });
      })
    );
    setup();
    await screen.findByText("9999112233");

    // Solo número corto y sin extensión: ambos campos fallan
    await userEvent.type(screen.getByLabelText("Número"), "123");
    await userEvent.click(screen.getByTestId("telefono-agregar"));

    const alertas = await screen.findAllByRole("alert");
    const textos = alertas.map((a) => a.textContent ?? "");
    expect(textos.some((t) => t.includes("al menos 6 dígitos"))).toBe(true);
    expect(llamadas).toBe(0);
  });

  it("quita un teléfono tras confirmar en el AlertDialog", async () => {
    let deleteUrl = "";
    mswServer.use(
      http.delete(`${PROXY}/phones/:id`, ({ params }) => {
        deleteUrl = String(params.id);
        return new HttpResponse(null, { status: 204 });
      })
    );
    setup();
    await screen.findByText("9999112233");

    await userEvent.click(screen.getByTestId("telefono-quitar-tel-1"));
    // Confirmación destructiva vía AlertDialog (baseline-ui): botón "Quitar"
    const dialogo = await screen.findByRole("alertdialog");
    expect(dialogo).toHaveTextContent(/¿quitar este teléfono\?/i);
    await userEvent.click(screen.getByRole("button", { name: "Quitar" }));

    await waitFor(() => expect(deleteUrl).toBe("tel-1"));
  });
});
