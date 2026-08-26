"use client";

/**
 * Consola de usuarios - mediCitas web
 * specs/web/staff-admin/spec.md: listado filtrable paginado, alta manual
 * con manejo de duplicados, activar/desactivar y gestión de roles.
 */
import { useState } from "react";
import { LocationSelector } from "@/modules/catalogs/components/location-selector";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useAsignarRol,
  useCambiarEstadoUsuario,
  useCrearCuenta,
  useQuitarRol,
  useRolesCatalogo,
  useUsuarios,
} from "../queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

const nuevaCuentaSchema = z
  .object({
    email: z.string().email("Correo inválido"),
    password: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .max(72, "Máximo 72 caracteres"),
    accountType: z.enum(["PATIENT", "EMPLOYEE"]),
    bloodType: z.string().optional(),
    roleNames: z.string().min(1, "Selecciona un rol"),
    firstName: z.string().min(1, "Obligatorio").max(50),
    lastName: z.string().min(1, "Obligatorio").max(50),
    birthDate: z.string().min(1, "Obligatorio"),
    dni: z.string().min(5, "Mínimo 5").max(20),
    gender: z.string().min(1, "Selecciona"),
    countryId: z.string().uuid("Elige un país"),
    departmentId: z.string().uuid("Elige un departamento"),
    municipalityId: z.string().uuid("Elige un municipio"),
  })
  .refine(
    (d) => d.accountType !== "PATIENT" || (d.bloodType ?? "") !== "",
    { message: "Requerido para pacientes", path: ["bloodType"] }
  );

type NuevaCuentaInput = z.infer<typeof nuevaCuentaSchema>;

export function UsuariosView() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [altaAbierta, setAltaAbierta] = useState(false);
  const [rolesDe, setRolesDe] = useState<{ id: string; email: string; roles: string[] } | null>(null);

  const usuarios = useUsuarios({ email, status, role, page });
  const cambiarEstado = useCambiarEstadoUsuario();
  const rolesCatalogo = useRolesCatalogo();
  const asignarRol = useAsignarRol();
  const quitarRol = useQuitarRol();

  const aplicarFiltro = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <section className="grid gap-4" aria-label="Gestión de usuarios" data-testid="usuarios-vista">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="filtro-email">Buscar correo</Label>
          <Input
            id="filtro-email"
            className="w-56"
            value={email}
            onChange={(e) => aplicarFiltro(() => setEmail(e.target.value))}
            placeholder="fragmento de correo"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="filtro-estado">Estado</Label>
          <select
            id="filtro-estado"
            className={selectClass}
            value={status}
            onChange={(e) => aplicarFiltro(() => setStatus(e.target.value))}
          >
            <option value="">Todos</option>
            <option value="ACTIVE">Activo</option>
            <option value="INACTIVE">Inactivo</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="filtro-rol">Rol</Label>
          <select
            id="filtro-rol"
            className={selectClass}
            value={role}
            onChange={(e) => aplicarFiltro(() => setRole(e.target.value))}
          >
            <option value="">Todos</option>
            {(rolesCatalogo.data?.items ?? []).map((r) => (
              <option key={r.id} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <Button className="ml-auto" data-testid="abrir-alta" onClick={() => setAltaAbierta(true)}>
          Nueva cuenta
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuario</TableHead>
            <TableHead>Correo</TableHead>
            <TableHead>Roles</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(usuarios.data?.items ?? []).map((u) => (
            <TableRow key={u.id} data-testid={`fila-${u.email}`}>
              <TableCell>{u.fullName}</TableCell>
              <TableCell>{u.email}</TableCell>
              <TableCell>{u.roles.join(", ")}</TableCell>
              <TableCell data-testid={`estado-${u.email}`}>{u.status}</TableCell>
              <TableCell className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    cambiarEstado.mutate({
                      id: u.id,
                      status: u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                    })
                  }
                  data-testid={`alternar-${u.email}`}
                >
                  {u.status === "ACTIVE" ? "Desactivar" : "Activar"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRolesDe({ id: u.id, email: u.email, roles: u.roles })}
                >
                  Roles
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex items-center gap-3 text-sm">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          data-testid="pag-anterior"
        >
          Anterior
        </Button>
        <span>
          Página {usuarios.data?.page ?? page} de {usuarios.data?.totalPages ?? 1}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={(usuarios.data?.totalPages ?? 1) <= page}
          onClick={() => setPage((p) => p + 1)}
          data-testid="pag-siguiente"
        >
          Siguiente
        </Button>
      </div>

      {altaAbierta ? (
        <NuevaCuentaDialog
          onCerrar={() => setAltaAbierta(false)}
        />
      ) : null}

      {rolesDe ? (
        <RolesDialog
          usuario={rolesDe}
          catalogo={rolesCatalogo.data?.items ?? []}
          onAsignar={(roleId) => asignarRol.mutateAsync({ userId: rolesDe.id, roleId })}
          onQuitar={(roleId) => quitarRol.mutateAsync({ userId: rolesDe.id, roleId })}
          onCerrar={() => setRolesDe(null)}
        />
      ) : null}
    </section>
  );
}

function NuevaCuentaDialog({ onCerrar }: { onCerrar: () => void }) {
  const crear = useCrearCuenta();
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<NuevaCuentaInput>({
    resolver: zodResolver(nuevaCuentaSchema),
    defaultValues: {
      accountType: "PATIENT",
      person: {},
    } as never,
  });

  const ubicacion = {
    countryId: watch("countryId") ?? "",
    departmentId: watch("departmentId") ?? "",
    municipalityId: watch("municipalityId") ?? "",
  };

  const onSubmit = async (v: NuevaCuentaInput) => {
    setErrorGlobal(null);
    try {
      // Endpoint ADMIN real: crea persona+usuario+rol sin tokens
      await crear.mutateAsync({
        email: v.email,
        password: v.password,
        accountType: v.accountType,
        ...(v.accountType === "PATIENT" ? { bloodType: v.bloodType } : {}),
        roleNames: [v.roleNames],
        person: {
          firstName: v.firstName,
          lastName: v.lastName,
          birthDate: v.birthDate,
          dni: v.dni,
          gender: v.gender,
          countryId: v.countryId,
          departmentId: v.departmentId,
          municipalityId: v.municipalityId,
        },
      });
      onCerrar();
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : String(err);
      if (/correo/i.test(mensaje)) setError("email", { message: mensaje });
      else if (/dni/i.test(mensaje)) setError("dni", { message: mensaje });
      else setErrorGlobal(mensaje);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-label="Nueva cuenta">
      <div className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Alta manual de cuenta</h2>
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="mt-4 grid gap-4"
          aria-label="Formulario de alta manual"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Correo" id="nc-correo" error={errors.email?.message}>
              <Input id="nc-correo" type="email" {...register("email")} />
            </Campo>
            <Campo label="Contraseña" id="nc-clave" error={errors.password?.message}>
              <Input id="nc-clave" type="password" {...register("password")} />
            </Campo>
            <Campo label="Tipo de cuenta" id="nc-tipo" error={errors.accountType?.message}>
              <select id="nc-tipo" className={selectClass + " w-full"} {...register("accountType")}>
                <option value="PATIENT">Paciente</option>
                <option value="EMPLOYEE">Empleado</option>
              </select>
            </Campo>
            <Campo label="Tipo de sangre" id="nc-sangre" error={errors.bloodType?.message}>
              <select id="nc-sangre" className={selectClass + " w-full"} {...register("bloodType")}>
                <option value="">—</option>
                <option value="A_POSITIVE">A+</option>
                <option value="O_POSITIVE">O+</option>
                <option value="O_NEGATIVE">O-</option>
              </select>
            </Campo>
            <Campo label="Primer nombre" id="nc-nombre" error={errors.firstName?.message}>
              <Input id="nc-nombre" {...register("firstName")} />
            </Campo>
            <Campo label="Primer apellido" id="nc-apellido" error={errors.lastName?.message}>
              <Input id="nc-apellido" {...register("lastName")} />
            </Campo>
            <Campo label="Fecha de nacimiento" id="nc-nacimiento" error={errors.birthDate?.message}>
              <Input id="nc-nacimiento" type="date" {...register("birthDate")} />
            </Campo>
            <Campo label="DNI" id="nc-dni" error={errors.dni?.message}>
              <Input id="nc-dni" {...register("dni")} />
            </Campo>
            <Campo label="Género" id="nc-genero" error={errors.gender?.message}>
              <select id="nc-genero" className={selectClass + " w-full"} {...register("gender")}>
                <option value="">Selecciona</option>
                <option value="Femenino">Femenino</option>
                <option value="Masculino">Masculino</option>
                <option value="Otro">Otro</option>
              </select>
            </Campo>
            <Campo label="Rol inicial" id="nc-rol" error={errors.roleNames?.message}>
              <select id="nc-rol" className={selectClass + " w-full"} {...register("roleNames")}>
                <option value="">Selecciona</option>
                <option value="PATIENT">PATIENT</option>
                <option value="EMPLOYEE">EMPLOYEE</option>
                <option value="DOCTOR">DOCTOR</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </Campo>
          </div>

          <LocationSelector
            value={ubicacion}
            onChange={(v) => {
              setValue("countryId", v.countryId);
              setValue("departmentId", v.departmentId);
              setValue("municipalityId", v.municipalityId);
            }}
            errors={{
              countryId: errors.countryId?.message,
              departmentId: errors.departmentId?.message,
              municipalityId: errors.municipalityId?.message,
            }}
            ids={{ countryId: "nc-pais", departmentId: "nc-depto", municipalityId: "nc-municipio" }}
          />

          {errorGlobal ? (
            <p className="text-sm text-destructive" role="alert" data-testid="alta-error-global">
              {errorGlobal}
            </p>
          ) : null}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} data-testid="alta-enviar">
              {isSubmitting ? "Creando…" : "Crear cuenta"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Campo({
  label,
  id,
  error,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}


function RolesDialog({
  usuario,
  catalogo,
  onAsignar,
  onQuitar,
  onCerrar,
}: {
  usuario: { id: string; email: string; roles: string[] };
  catalogo: Array<{ id: string; name: string; status: string }>;
  onAsignar: (roleId: string) => Promise<unknown>;
  onQuitar: (roleId: string) => Promise<unknown>;
  onCerrar: () => void;
}) {
  const roleIdPorNombre = new Map(catalogo.map((r) => [r.name, r.id]));
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-label={`Roles de ${usuario.email}`}>
      <div className="w-full max-w-md rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Roles · {usuario.email}</h2>
        <ul className="mt-4 grid gap-2">
          {catalogo.map((rol) => {
            const activo = usuario.roles.includes(rol.name);
            return (
              <li key={rol.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                <span>{rol.name}</span>
                {activo ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onQuitar(rol.id)}
                    data-testid={`quitar-rol-${rol.name}`}
                  >
                    Quitar
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAsignar(rol.id)}
                    data-testid={`asignar-rol-${rol.name}`}
                  >
                    Asignar
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Nota: los IDs de rol se resuelven desde el catálogo ({roleIdPorNombre.size} roles).
        </p>
        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={onCerrar}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
