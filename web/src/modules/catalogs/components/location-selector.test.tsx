/**
 * Pruebas del selector jerárquico de ubicación - specs/web/catalogs/spec.md
 * Carga dependiente país -> departamento -> municipio, reinicio de
 * dependencias, errores por campo y accesibilidad (axe-core).
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import {
  LocationSelector,
  type UbicacionValue,
} from "./location-selector";
import { newQueryClient, violacionesGraves } from "@/testing/test-utils";
import { QueryClientProvider } from "@tanstack/react-query";


function Wrapper({ children }: { children: React.ReactNode }) {
  const [client] = [newQueryClient()];
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function Contenedor({
  onCambios,
}: {
  onCambios?: (v: UbicacionValue) => void;
}) {
  const [value, setValue] = useState<UbicacionValue>({
    countryId: "",
    departmentId: "",
    municipalityId: "",
  });
  return (
    <LocationSelector
      value={value}
      onChange={(v) => {
        setValue(v);
        onCambios?.(v);
      }}
      errors={{
        countryId: value.countryId === "" ? "Elige un país" : undefined,
      }}
    />
  );
}

describe("Selector jerárquico de ubicación", () => {
  it("departamento y municipio están deshabilitados al inicio", () => {
    render(<Contenedor />, { wrapper: Wrapper });
    expect(screen.getByLabelText("País")).toBeEnabled();
    expect(screen.getByLabelText("Departamento")).toBeDisabled();
    expect(screen.getByLabelText("Municipio")).toBeDisabled();
  });

  it("al elegir país se cargan sus departamentos", async () => {
    render(<Contenedor />, { wrapper: Wrapper });
    await waitFor(() =>
      expect((screen.getByLabelText("País") as HTMLSelectElement).options.length)
        .toBeGreaterThan(1)
    );

    fireEvent.change(screen.getByLabelText("País"), {
      target: { value: "11111111-1111-4111-8111-111111111111" },
    });

    const depto = await waitFor(() => {
      const el = screen.getByLabelText("Departamento") as HTMLSelectElement;
      expect(el).toBeEnabled();
      expect(el.options.length).toBeGreaterThan(1);
      return el;
    });
    expect(depto.options[1]?.textContent).toBe("Francisco Morazán");
  });

  it("al elegir departamento se cargan los municipios", async () => {
    render(<Contenedor />, { wrapper: Wrapper });
    await waitFor(() =>
      expect(
        (screen.getByLabelText("País") as HTMLSelectElement).options.length
      ).toBeGreaterThan(1)
    );
    fireEvent.change(screen.getByLabelText("País"), { target: { value: "11111111-1111-4111-8111-111111111111" } });
    await waitFor(() =>
      expect(
        (screen.getByLabelText("Departamento") as HTMLSelectElement).options.length
      ).toBeGreaterThan(1)
    );
    fireEvent.change(screen.getByLabelText("Departamento"), {
      target: { value: "33333333-3333-4333-8333-333333333333" },
    });

    const muni = await waitFor(() => {
      const el = screen.getByLabelText("Municipio") as HTMLSelectElement;
      expect(el).toBeEnabled();
      expect(el.options.length).toBeGreaterThan(1);
      return el;
    });
    expect(muni.options[1]?.textContent).toBe("Tegucigalpa");
  });

  it("reinicia departamento y municipio al cambiar de país", async () => {
    const cambios: UbicacionValue[] = [];
    render(<Contenedor onCambios={(v) => cambios.push(v)} />, { wrapper: Wrapper });
    await waitFor(() =>
      expect(
        (screen.getByLabelText("País") as HTMLSelectElement).options.length
      ).toBeGreaterThan(1)
    );

    fireEvent.change(screen.getByLabelText("País"), { target: { value: "11111111-1111-4111-8111-111111111111" } });
    await waitFor(() =>
      expect(cambios.at(-1)?.countryId).toBe("11111111-1111-4111-8111-111111111111")
    );

    // Cambiar a otro país limpia las dependencias
    fireEvent.change(screen.getByLabelText("País"), { target: { value: "22222222-2222-4222-8222-222222222222" } });
    await waitFor(() => {
      const ultimo = cambios.at(-1);
      expect(ultimo?.departmentId).toBe("");
      expect(ultimo?.municipalityId).toBe("");
    });
  });

  it("muestra el error del campo país junto al selector", () => {
    render(<Contenedor />, { wrapper: Wrapper });
    expect(screen.getByRole("alert")).toHaveTextContent("Elige un país");
  });

  it("no presenta violaciones graves de accesibilidad (axe)", async () => {
    const { container } = render(<Contenedor />, { wrapper: Wrapper });
    await waitFor(() =>
      expect(
        (screen.getByLabelText("País") as HTMLSelectElement).options.length
      ).toBeGreaterThan(1)
    );
    const violations = await violacionesGraves(container);
    expect(violations).toEqual([]);
  });
});
