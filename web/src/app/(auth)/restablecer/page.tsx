"use client";

/**
 * Restablecimiento de contraseña con token - mediCitas web
 * Token inválido/expirado muestra error y opción de solicitar uno nuevo.
 */
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import {
  resetFormSchema,
  type ResetFormInput,
} from "@/modules/auth/schemas";
// Nota: el tipo del contrato de API se llama ResetPasswordInput; el formulario
// usa ResetFormInput (sin el campo token, que viaja por query).
import { apiErrorFromResponse, userMessage } from "@/shared/api/errors";
import { appUrl } from "@/shared/api/client-url";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const tokenInvalido = token.length < 20;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetFormInput>({ resolver: zodResolver(resetFormSchema) });

  const onSubmit = async (values: ResetFormInput) => {
    setServerError(null);
    try {
      const res = await fetch(appUrl("/api/v1/auth/reset-password"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, newPassword: values.newPassword }),
      });
      if (res.status === 204) {
        setDone(true);
        return;
      }
      const body = await res.json().catch(() => null);
      throw apiErrorFromResponse(res.status, body);
    } catch (err) {
      setServerError(userMessage(err));
    }
  };

  if (!tokenInvalido && done) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-balance">Contraseña actualizada</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-pretty" data-testid="reset-exito">
            Tu contraseña se actualizó correctamente.
          </p>
          <a
            href="/login"
            className="mt-4 inline-block text-sm underline underline-offset-2"
            data-testid="reset-ir-login"
          >
            Iniciar sesión
          </a>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-balance">Nueva contraseña</CardTitle>
        <CardDescription className="text-pretty">
          Define tu nueva contraseña para continuar
        </CardDescription>
      </CardHeader>
      <CardContent>
        {tokenInvalido ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-destructive" role="alert" data-testid="reset-token-invalido">
              El enlace no es válido o expiró. Solicita uno nuevo.
            </p>
            <Button asChild variant="outline">
              <a href="/olvide-contrasena">Solicitar nuevo enlace</a>
            </Button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-4"
            aria-label="Formulario de restablecimiento de contraseña"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="reset-clave">Nueva contraseña</Label>
              <Input
                id="reset-clave"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.newPassword)}
                {...register("newPassword")}
              />
              {errors.newPassword ? (
                <p className="text-sm text-destructive" role="alert">
                  {errors.newPassword.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="reset-confirmar">Confirmar contraseña</Label>
              <Input
                id="reset-confirmar"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.confirmPassword)}
                {...register("confirmPassword")}
              />
              {errors.confirmPassword ? (
                <p className="text-sm text-destructive" role="alert">
                  {errors.confirmPassword.message}
                </p>
              ) : null}
            </div>

            {serverError ? (
              <div className="text-sm text-destructive" role="alert" data-testid="reset-error">
                <p>{serverError}</p>
                <a href="/olvide-contrasena" className="underline underline-offset-2">
                  Solicitar un nuevo enlace
                </a>
              </div>
            ) : null}

            <Button type="submit" disabled={isSubmitting} data-testid="reset-enviar">
              {isSubmitting ? "Guardando…" : "Guardar contraseña"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
