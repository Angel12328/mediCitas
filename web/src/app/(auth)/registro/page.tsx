"use client";

/**
 * Autoregistro publico de pacientes - mediCitas web
 * specs/web/patient-onboarding/spec.md
 * Secciones: datos personales, ubicacion jerarquica y credenciales.
 */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  registroFormSchema,
  TIPOS_DE_SANGRE,
  type RegistroFormInput,
} from "@/modules/onboarding/schemas";
import { apiErrorFromResponse } from "@/shared/api/errors";
import { appUrl } from "@/shared/api/client-url";
import { LocationSelector } from "@/modules/catalogs/components/location-selector";
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

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20";

export default function RegistroPage() {
  const [creado, setCreado] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegistroFormInput>({
    resolver: zodResolver(registroFormSchema),
    defaultValues: {
      person: {
        countryId: "",
        departmentId: "",
        municipalityId: "",
      },
    },
  });

  const ubicacion = {
    countryId: watch("person.countryId") ?? "",
    departmentId: watch("person.departmentId") ?? "",
    municipalityId: watch("person.municipalityId") ?? "",
  };

  const onSubmit = async (values: RegistroFormInput) => {
    setErrorGlobal(null);
    try {
      const res = await fetch(appUrl("/api/v1/auth/register"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          accountType: "PATIENT",
          bloodType: values.bloodType,
          person: values.person,
        }),
      });
      if (res.status === 201) {
        setCreado(true);
        return;
      }
      const body = await res.json().catch(() => null);
      const problem = apiErrorFromResponse(res.status, body);

      // Duplicados: el backend informa via detail del problema (RFC 9457)
      if (problem.code === "CONFLICT") {
        const titulo = problem.userFacingDetail.toLowerCase();
        if (titulo.includes("correo")) {
          setError("email", { message: problem.message });
          return;
        }
        if (titulo.includes("dni")) {
          setError("person.dni", { message: problem.message });
          return;
        }
      }
      setErrorGlobal(problem.message);
    } catch {
      setErrorGlobal("No hay conexion con el servidor. Verifica tu conexion.");
    }
  };

  if (creado) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-balance">Cuenta creada</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-pretty" data-testid="registro-exito">
            Tu cuenta de paciente fue creada correctamente. Ingresa con tu
            correo y contrasena para empezar a agendar.
          </p>
          <Button asChild className="mt-4" data-testid="registro-ir-login">
            <a href="/login">Iniciar sesion</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const err =
    (campo: string) =>
    (
      errors.person as Record<string, { message?: string }> | undefined
    )?.[campo]?.message;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-balance">Crea tu cuenta de paciente</CardTitle>
        <CardDescription className="text-pretty">
          Registrate para agendar citas medicas en minutos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-6"
          aria-label="Formulario de registro de paciente"
        >
          <fieldset className="grid gap-4">
            <legend className="text-sm font-semibold text-muted-foreground">
              Datos personales
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="reg-nombre">Primer nombre</Label>
                <Input id="reg-nombre" autoComplete="given-name" {...register("person.firstName")} />
                {err("firstName") ? (
                  <p className="text-sm text-destructive" role="alert">{err("firstName")}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="reg-apellido">Primer apellido</Label>
                <Input id="reg-apellido" autoComplete="family-name" {...register("person.lastName")} />
                {err("lastName") ? (
                  <p className="text-sm text-destructive" role="alert">{err("lastName")}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="reg-nacimiento">Fecha de nacimiento</Label>
                <Input id="reg-nacimiento" type="date" autoComplete="bday" {...register("person.birthDate")} />
                {err("birthDate") ? (
                  <p className="text-sm text-destructive" role="alert">{err("birthDate")}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="reg-dni">DNI</Label>
                <Input id="reg-dni" inputMode="numeric" {...register("person.dni")} />
                {err("dni") ? (
                  <p className="text-sm text-destructive" role="alert">{err("dni")}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="reg-genero">Género</Label>
                <select id="reg-genero" className={selectClass} {...register("person.gender")}>
                  <option value="">Selecciona</option>
                  <option value="Femenino">Femenino</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Otro">Otro</option>
                </select>
                {err("gender") ? (
                  <p className="text-sm text-destructive" role="alert">{err("gender")}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="reg-sangre">Tipo de sangre</Label>
                <select id="reg-sangre" className={selectClass} {...register("bloodType")}>
                  <option value="">Selecciona</option>
                  {TIPOS_DE_SANGRE.map((t) => (
                    <option key={t} value={t}>{t.replace("_", " ")}</option>
                  ))}
                </select>
                {errors.bloodType ? (
                  <p className="text-sm text-destructive" role="alert">{errors.bloodType.message}</p>
                ) : null}
              </div>
            </div>
          </fieldset>

          <fieldset className="grid gap-4">
            <legend className="text-sm font-semibold text-muted-foreground">
              Ubicación
            </legend>
            <LocationSelector
              value={ubicacion}
              onChange={(v) => {
                // Sincroniza el selector jerarquico con react-hook-form
                setValue("person.countryId", v.countryId);
                setValue("person.departmentId", v.departmentId);
                setValue("person.municipalityId", v.municipalityId);
              }}
              errors={{
                countryId: err("countryId"),
                departmentId: err("departmentId"),
                municipalityId: err("municipalityId"),
              }}
              ids={{ countryId: "reg-pais", departmentId: "reg-depto", municipalityId: "reg-municipio" }}
            />
          </fieldset>

          <fieldset className="grid gap-4">
            <legend className="text-sm font-semibold text-muted-foreground">
              Credenciales de acceso
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="reg-correo">Correo</Label>
                <Input id="reg-correo" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} {...register("email")} />
                {errors.email ? (
                  <p className="text-sm text-destructive" role="alert">{errors.email.message}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="reg-clave">Contraseña</Label>
                <Input id="reg-clave" type="password" autoComplete="new-password" aria-invalid={Boolean(errors.password)} {...register("password")} />
                {errors.password ? (
                  <p className="text-sm text-destructive" role="alert">{errors.password.message}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="reg-confirmar">Confirmar contraseña</Label>
                <Input id="reg-confirmar" type="password" autoComplete="new-password" aria-invalid={Boolean(errors.confirmPassword)} {...register("confirmPassword")} />
                {errors.confirmPassword ? (
                  <p className="text-sm text-destructive" role="alert">{errors.confirmPassword.message}</p>
                ) : null}
              </div>
            </div>
          </fieldset>

          {errorGlobal ? (
            <p className="text-sm text-destructive" role="alert" data-testid="registro-error-global">{errorGlobal}</p>
          ) : null}

          <Button type="submit" disabled={isSubmitting} data-testid="registro-enviar">
            {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
          </Button>

          <a href="/login" className="text-sm underline underline-offset-2">
            Ya tengo cuenta
          </a>
        </form>
      </CardContent>
    </Card>
  );
}
