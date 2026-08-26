"use client";

/**
 * Edición de datos personales del perfil - mediCitas web
 * DNI y fecha de nacimiento son solo lectura (specs/web/profiles/spec.md).
 */
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  updatePerfilSchema,
  type UpdatePerfilInput,
  type PerfilResponse,
} from "../schemas";
import { apiErrorFromResponse, userMessage } from "@/shared/api/errors";
import { appUrl } from "@/shared/api/client-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function ProfileEditor({ perfil }: { perfil: PerfilResponse }) {
  const [mensaje, setMensaje] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdatePerfilInput>({
    resolver: zodResolver(updatePerfilSchema),
    defaultValues: {
      person: {
        firstName: perfil.person.fullName.split(" ")[0] ?? "",
        lastName:
          perfil.person.fullName.split(" ").slice(-1)[0] ?? "",
        gender: perfil.person.gender,
        address: perfil.person.address ?? "",
      },
    },
  });

  const mutacion = useMutation({
    mutationFn: async (values: UpdatePerfilInput) => {
      const res = await fetch(appUrl("/api/proxy/users/me"), {
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
    onSuccess: () => setMensaje("Cambios guardados correctamente."),
    onError: (err) => setMensaje(userMessage(err)),
  });

  return (
    <form
      onSubmit={handleSubmit((v) => mutacion.mutate(v))}
      noValidate
      className="grid gap-4"
      aria-label="Edición de datos personales"
      data-testid="perfil-editor"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="perfil-nombre">Primer nombre</Label>
          <Input id="perfil-nombre" {...register("person.firstName")} />
          {errors.person?.firstName ? (
            <p className="text-sm text-destructive" role="alert">
              {errors.person.firstName.message}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="perfil-apellido">Primer apellido</Label>
          <Input id="perfil-apellido" {...register("person.lastName")} />
          {errors.person?.lastName ? (
            <p className="text-sm text-destructive" role="alert">
              {errors.person.lastName.message}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="perfil-genero">Género</Label>
          <select
            id="perfil-genero"
            className={selectClass}
            {...register("person.gender")}
          >
            <option value="">Selecciona</option>
            <option value="Femenino">Femenino</option>
            <option value="Masculino">Masculino</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="perfil-direccion">Dirección</Label>
          <Input id="perfil-direccion" {...register("person.address")} />
        </div>
      </div>

      {/* Solo lectura */}
      <div className="grid gap-4 rounded-md border p-4 sm:grid-cols-2" data-testid="perfil-solo-lectura">
        <div>
          <Label>DNI (no editable)</Label>
          <p className="text-sm">{perfil.person.dni}</p>
        </div>
        <div>
          <Label>Fecha de nacimiento (no editable)</Label>
          <p className="text-sm">{perfil.person.birthDate.slice(0, 10)}</p>
        </div>
      </div>

      {mensaje ? (
        <p
          role="status"
          data-testid="perfil-mensaje"
          className={mensaje.startsWith("Cambios") ? "text-sm text-primary" : "text-sm text-destructive"}
        >
          {mensaje}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting} data-testid="perfil-guardar" className="w-fit">
        {isSubmitting ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  );
}
