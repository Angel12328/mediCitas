"use client";

/**
 * Datos clínicos del paciente - mediCitas web
 * Solo visible para PACIENTE (specs/web/profiles/spec.md).
 */
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import {
  datosClinicosSchema,
  emergenciaSchema,
  type DatosClinicosInput,
} from "../schemas";
import { apiErrorFromResponse, userMessage } from "@/shared/api/errors";
import { appUrl } from "@/shared/api/client-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function ClinicalData({
  bloodTypeInicial,
  allergiesInicial,
  contactoNombre,
  contactoNumero,
}: {
  bloodTypeInicial: string;
  allergiesInicial: string | null;
  contactoNombre: string | null;
  contactoNumero: string | null;
}) {
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [errorClinico, setErrorClinico] = useState<string | null>(null);
  const [errorEmergencia, setErrorEmergencia] = useState<string | null>(null);

  const clinicos = useForm<DatosClinicosInput>({
    resolver: zodResolver(datosClinicosSchema),
    defaultValues: {
      bloodType: (bloodTypeInicial as DatosClinicosInput["bloodType"]) || undefined,
      allergies: allergiesInicial ?? "",
    },
  });

  const emergencia = useForm<{
    emergencyContactName: string;
    emergencyContactNumber: string;
  }>({
    resolver: zodResolver(emergenciaSchema),
    defaultValues: {
      emergencyContactName: contactoNombre ?? "",
      emergencyContactNumber: contactoNumero ?? "",
    },
  });

  const guardarClinicos = useMutation({
    mutationFn: async (values: DatosClinicosInput) => {
      const res = await fetch(appUrl("/api/proxy/patients/me"), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bloodType: values.bloodType,
          allergies: values.allergies || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw apiErrorFromResponse(res.status, body);
      }
      return res.json();
    },
    onSuccess: () => {
      setErrorClinico(null);
      setMensaje("Datos clínicos guardados.");
    },
    onError: (err) => setErrorClinico(userMessage(err)),
  });

  const guardarEmergencia = useMutation({
    mutationFn: async (
      values: { emergencyContactName: string; emergencyContactNumber: string }
    ) => {
      const res = await fetch(appUrl("/api/proxy/patients/me/emergency-contact"), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw apiErrorFromResponse(res.status, body);
      }
      return res.json();
    },
    onSuccess: () => {
      setErrorEmergencia(null);
      setMensaje("Contacto de emergencia guardado.");
    },
    onError: (err) => setErrorEmergencia(userMessage(err)),
  });

  return (
    <section className="grid gap-6" aria-label="Datos clínicos" data-testid="clinicos-seccion">
      <form
        onSubmit={clinicos.handleSubmit((v) => guardarClinicos.mutate(v))}
        noValidate
        className="grid gap-3"
        aria-label="Tipo de sangre y alergias"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="clin-sangre">Tipo de sangre</Label>
            <select
              id="clin-sangre"
              className={selectClass}
              aria-invalid={Boolean(clinicos.formState.errors.bloodType)}
              {...clinicos.register("bloodType")}
            >
              <option value="">Selecciona</option>
              <option value="A_POSITIVE">A+</option>
              <option value="A_NEGATIVE">A-</option>
              <option value="B_POSITIVE">B+</option>
              <option value="B_NEGATIVE">B-</option>
              <option value="AB_POSITIVE">AB+</option>
              <option value="AB_NEGATIVE">AB-</option>
              <option value="O_POSITIVE">O+</option>
              <option value="O_NEGATIVE">O-</option>
            </select>
            {clinicos.formState.errors.bloodType ? (
              <p className="text-sm text-destructive" role="alert">
                {clinicos.formState.errors.bloodType.message}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="clin-alergias">Alergias</Label>
            <Input id="clin-alergias" placeholder="Penicilina, polen…" {...clinicos.register("allergies")} />
            {clinicos.formState.errors.allergies ? (
              <p className="text-sm text-destructive" role="alert">
                {clinicos.formState.errors.allergies.message}
              </p>
            ) : null}
          </div>
        </div>
        {errorClinico ? (
          <p className="text-sm text-destructive" role="alert" data-testid="clinicos-error">
            {errorClinico}
          </p>
        ) : null}
        <Button type="submit" variant="outline" className="w-fit" disabled={guardarClinicos.isPending} data-testid="clinicos-guardar">
          {guardarClinicos.isPending ? "Guardando…" : "Guardar datos clínicos"}
        </Button>
      </form>

      <form
        onSubmit={emergencia.handleSubmit((v) => guardarEmergencia.mutate(v))}
        noValidate
        className="grid gap-3 border-t pt-4"
        aria-label="Contacto de emergencia"
      >
        <p className="text-sm font-semibold text-muted-foreground">
          Contacto de emergencia
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="emer-nombre">Nombre</Label>
            <Input id="emer-nombre" {...emergencia.register("emergencyContactName")} />
            {emergencia.formState.errors.emergencyContactName ? (
              <p className="text-sm text-destructive" role="alert">
                {emergencia.formState.errors.emergencyContactName.message}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="emer-numero">Número</Label>
            <Input id="emer-numero" inputMode="tel" {...emergencia.register("emergencyContactNumber")} />
            {emergencia.formState.errors.emergencyContactNumber ? (
              <p className="text-sm text-destructive" role="alert">
                {emergencia.formState.errors.emergencyContactNumber.message}
              </p>
            ) : null}
          </div>
        </div>
        {errorEmergencia ? (
          <p className="text-sm text-destructive" role="alert" data-testid="emergencia-error">
            {errorEmergencia}
          </p>
        ) : null}
        <Button type="submit" variant="outline" className="w-fit" disabled={guardarEmergencia.isPending} data-testid="emergencia-guardar">
          {guardarEmergencia.isPending ? "Guardando…" : "Guardar contacto"}
        </Button>
      </form>

      {mensaje ? (
        <p role="status" className="text-sm text-primary" data-testid="clinicos-mensaje">
          {mensaje}
        </p>
      ) : null}
    </section>
  );
}
