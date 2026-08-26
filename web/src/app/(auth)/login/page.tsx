"use client";

/**
 * Pantalla de inicio de sesión - mediCitas web
 * Envía credenciales al Route Handler de sesión; el backend es la autoridad.
 */
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { loginSchema, type LoginInput } from "@/modules/auth/schemas";
import { apiErrorFromResponse, userMessage } from "@/shared/api/errors";
import { appUrl } from "@/shared/api/client-url";
import { esNextSeguro, homeForRoles } from "@/shared/auth/roles";
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

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginInput) => {
    setServerError(null);
    try {
      const res = await fetch(appUrl("/api/auth/session"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw apiErrorFromResponse(res.status, body);
      }
      const data = (await res.json()) as { user: { roles: string[] } };
      const next = searchParams.get("next");
      router.replace(esNextSeguro(next) ? next! : homeForRoles(data.user.roles));
      router.refresh();
    } catch (err) {
      setServerError(userMessage(err));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-balance">Inicia sesión</CardTitle>
        <CardDescription className="text-pretty">
          Accede a tu cuenta de mediCitas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-4"
          aria-label="Formulario de inicio de sesión"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="login-correo">Correo</Label>
            <Input
              id="login-correo"
              type="email"
              autoComplete="email"
              placeholder="tu@correo.com"
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
            />
            {errors.email ? (
              <p className="text-sm text-destructive" role="alert">
                {errors.email.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="login-clave">Contraseña</Label>
            <Input
              id="login-clave"
              type="password"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              {...register("password")}
            />
            {errors.password ? (
              <p className="text-sm text-destructive" role="alert">
                {errors.password.message}
              </p>
            ) : null}
          </div>

          {serverError ? (
            <p className="text-sm text-destructive" role="alert" data-testid="login-error">
              {serverError}
            </p>
          ) : null}

          <Button type="submit" disabled={isSubmitting} data-testid="login-enviar">
            {isSubmitting ? "Ingresando…" : "Ingresar"}
          </Button>

          <div className="flex justify-between text-sm">
            <a href="/olvide-contrasena" className="underline underline-offset-2">
              Olvidé mi contraseña
            </a>
            <a href="/registro" className="underline underline-offset-2">
              Crear cuenta
            </a>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
