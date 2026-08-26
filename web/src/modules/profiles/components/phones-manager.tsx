"use client";

/**
 * Gestión de teléfonos propios - mediCitas web
 * Agregar y quitar teléfonos con extensión (specs/web/profiles/spec.md).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import {
  crearTelefonoSchema,
  type CrearTelefonoInput,
} from "../schemas";
import { apiErrorFromResponse, userMessage } from "@/shared/api/errors";
import { appUrl } from "@/shared/api/client-url";
import { useExtensiones } from "@/modules/catalogs/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

interface Telefono {
  id: string;
  number: string;
  extensionName?: string | null;
}

export function PhonesManager({ personId }: { personId: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const telefonos = useQuery({
    queryKey: ["telefonos", personId],
    queryFn: async (): Promise<Telefono[]> => {
      const res = await fetch(appUrl("/api/proxy/phones"), { cache: "no-store" });
      if (!res.ok) throw new Error("No se pudieron cargar los teléfonos");
      const data = (await res.json()) as { items: Telefono[] };
      return data.items;
    },
  });

  const extensiones = useExtensiones();

  const agregar = useMutation({
    mutationFn: async (values: CrearTelefonoInput) => {
      const res = await fetch(appUrl("/api/proxy/phones"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, personId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw apiErrorFromResponse(res.status, body);
      }
      return res.json();
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["telefonos", personId] });
    },
    onError: (err) => setError(userMessage(err)),
  });

  const quitar = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(appUrl(`/api/proxy/phones/${id}`), {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => null);
        throw apiErrorFromResponse(res.status, body);
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["telefonos", personId] }),
    onError: (err) => setError(userMessage(err)),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CrearTelefonoInput>({ resolver: zodResolver(crearTelefonoSchema) });

  return (
    <section className="grid gap-4" aria-label="Teléfonos" data-testid="telefonos-seccion">
      <ul className="grid gap-2">
        {(telefonos.data ?? []).map((t) => (
          <li
            key={t.id}
            className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
          >
            <span>
              {t.number}
              {t.extensionName ? (
                <span className="text-muted-foreground"> · {t.extensionName}</span>
              ) : null}
            </span>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" data-testid={`telefono-quitar-${t.id}`}>
                  Quitar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Quitar este teléfono?</AlertDialogTitle>
                  <AlertDialogDescription>
                    El número {t.number} dejará de estar asociado a tu perfil.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => quitar.mutate(t.id)}>
                    Quitar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </li>
        ))}
        {telefonos.data?.length === 0 ? (
          <li className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
            No tienes teléfonos registrados. Agrega el primero abajo.
          </li>
        ) : null}
      </ul>

      <form
        onSubmit={handleSubmit((v) => {
          agregar.mutate(v, { onSuccess: () => reset() });
        })}
        noValidate
        className="flex flex-wrap items-end gap-3"
        aria-label="Agregar teléfono"
      >
        <div className="flex flex-col gap-1">
          <Label htmlFor="tel-numero">Número</Label>
          <Input
            id="tel-numero"
            inputMode="numeric"
            className="w-40"
            aria-invalid={Boolean(errors.number)}
            {...register("number")}
          />
          {errors.number ? (
            <p className="text-sm text-destructive" role="alert">
              {errors.number.message}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="tel-extension">Extensión</Label>
          <select id="tel-extension" className={selectClass + " w-32"} {...register("extensionId")}>
            <option value="">Selecciona</option>
            {(extensiones.data ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          {errors.extensionId ? (
            <p className="text-sm text-destructive" role="alert">
              {errors.extensionId.message}
            </p>
          ) : null}
        </div>
        <Button type="submit" variant="outline" disabled={agregar.isPending} data-testid="telefono-agregar">
          {agregar.isPending ? "Agregando…" : "Agregar"}
        </Button>
      </form>

      {error ? (
        <p className="text-sm text-destructive" role="alert" data-testid="telefonos-error">
          {error}
        </p>
      ) : null}
    </section>
  );
}
