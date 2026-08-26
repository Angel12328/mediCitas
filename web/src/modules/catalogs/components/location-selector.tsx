"use client";

/**
 * Selector jerárquico de ubicacion - mediCitas web
 * Pais -> departamento -> municipio con carga dependiente.
 * Controlado por el formulario padre (react-hook-form).
 */
import { useEffect } from "react";
import { useDepartamentos, useMunicipios, usePaises } from "../queries";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface UbicacionValue {
  countryId: string;
  departmentId: string;
  municipalityId: string;
}

interface LocationSelectorProps {
  value: UbicacionValue;
  onChange: (value: UbicacionValue) => void;
  errors?: Partial<Record<keyof UbicacionValue, string>>;
  ids?: Partial<Record<keyof UbicacionValue, string>>;
}

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 disabled:opacity-50";

export function LocationSelector({
  value,
  onChange,
  errors = {},
  ids = {},
}: LocationSelectorProps) {
  const paises = usePaises();
  const departamentos = useDepartamentos(value.countryId || undefined);
  const municipios = useMunicipios(value.departmentId || undefined);

  // Al cambiar el pais se invalidan las selecciones dependientes
  useEffect(() => {
    if (
      value.countryId &&
      departamentos.data &&
      !departamentos.data.some((d) => d.id === value.departmentId)
    ) {
      onChange({ ...value, departmentId: "", municipalityId: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departamentos.data]);

  useEffect(() => {
    if (
      value.departmentId &&
      municipios.data &&
      !municipios.data.some((m) => m.id === value.municipalityId)
    ) {
      onChange({ ...value, municipalityId: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [municipios.data]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.countryId ?? "ubicacion-pais"}>País</Label>
        <select
          id={ids.countryId ?? "ubicacion-pais"}
          className={cn(selectClass)}
          value={value.countryId}
          aria-invalid={Boolean(errors.countryId)}
          onChange={(e) => onChange({ ...value, countryId: e.target.value })}
        >
          <option value="">Selecciona un país</option>
          {(paises.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {errors.countryId ? (
          <p className="text-sm text-destructive" role="alert">
            {errors.countryId}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.departmentId ?? "ubicacion-departamento"}>
          Departamento
        </Label>
        <select
          id={ids.departmentId ?? "ubicacion-departamento"}
          className={cn(selectClass)}
          value={value.departmentId}
          disabled={!value.countryId}
          aria-invalid={Boolean(errors.departmentId)}
          onChange={(e) => onChange({ ...value, departmentId: e.target.value })}
        >
          <option value="">
            {value.countryId ? "Selecciona un departamento" : "Elige un país primero"}
          </option>
          {(departamentos.data ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        {errors.departmentId ? (
          <p className="text-sm text-destructive" role="alert">
            {errors.departmentId}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.municipalityId ?? "ubicacion-municipio"}>
          Municipio
        </Label>
        <select
          id={ids.municipalityId ?? "ubicacion-municipio"}
          className={cn(selectClass)}
          value={value.municipalityId}
          disabled={!value.departmentId}
          aria-invalid={Boolean(errors.municipalityId)}
          onChange={(e) => onChange({ ...value, municipalityId: e.target.value })}
        >
          <option value="">
            {value.departmentId
              ? "Selecciona un municipio"
              : "Elige un departamento primero"}
          </option>
          {(municipios.data ?? []).map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        {errors.municipalityId ? (
          <p className="text-sm text-destructive" role="alert">
            {errors.municipalityId}
          </p>
        ) : null}
      </div>
    </div>
  );
}
