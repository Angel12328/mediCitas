"use client";

/**
 * Solicitud de restablecimiento de contraseña - mediCitas web
 * Confirmación neutra siempre (anti-enumeración, según specs/web/auth).
 */
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/modules/auth/schemas";
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

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (values: ForgotPasswordInput) => {
    await fetch(appUrl("/api/v1/auth/forgot-password"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    }).catch(() => undefined);
    setSent(true);
  };

  if (sent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-balance">Revisa tu correo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-pretty" data-testid="olvide-confirmacion">
            Si el correo está registrado, recibirás instrucciones para
            restablecer tu contraseña.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-balance">Recuperar contraseña</CardTitle>
        <CardDescription className="text-pretty">
          Te enviaremos instrucciones a tu correo
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-4"
          aria-label="Formulario de recuperación de contraseña"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="olvide-correo">Correo</Label>
            <Input
              id="olvide-correo"
              type="email"
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
            />
            {errors.email ? (
              <p className="text-sm text-destructive" role="alert">
                {errors.email.message}
              </p>
            ) : null}
          </div>

          <Button type="submit" disabled={isSubmitting} data-testid="olvide-enviar">
            {isSubmitting ? "Enviando…" : "Enviar instrucciones"}
          </Button>

          <a href="/login" className="text-sm underline underline-offset-2">
            Volver al inicio de sesión
          </a>
        </form>
      </CardContent>
    </Card>
  );
}
