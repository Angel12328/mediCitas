import Link from "next/link";

export default function AdministracionPage() {
  const secciones = [
    { href: "/administracion/usuarios", titulo: "Usuarios y roles", desc: "Listado, alta manual, estados y roles." },
    { href: "/administracion/personal", titulo: "Personal", desc: "Empleados, cargos e historial." },
    { href: "/administracion/doctores", titulo: "Doctores", desc: "Doctores y especialidades." },
    { href: "/administracion/horarios", titulo: "Horarios", desc: "Franjas de atención (Fase 5)." },
    { href: "/administracion/citas", titulo: "Citas", desc: "Gestión de citas (Fase 5)." },
  ];
  return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-semibold">Panel de administración</h1>
      <ul className="grid gap-3 sm:grid-cols-2">
        {secciones.map((s) => (
          <li key={s.href} className="rounded-lg border p-4">
            {s.href.includes("horarios") || s.href.includes("citas") ? (
              <>
                <p className="font-medium">{s.titulo}</p>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </>
            ) : (
              <Link href={s.href} className="group grid gap-1" data-testid={`panel-link${s.href.replace("/", "-")}`}>
                <span className="font-medium underline-offset-2 group-hover:underline">{s.titulo}</span>
                <span className="text-sm text-muted-foreground">{s.desc}</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
