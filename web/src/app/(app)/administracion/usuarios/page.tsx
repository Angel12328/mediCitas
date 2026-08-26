import { UsuariosView } from "@/modules/staff-admin/components/usuarios-view";

export default function UsuariosPage() {
  return (
    <section className="grid gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-balance">Usuarios y roles</h1>
        <p className="text-sm text-muted-foreground">
          Alta manual de cuentas, estados y asignación de roles.
        </p>
      </header>
      <UsuariosView />
    </section>
  );
}
