"use client";

/**
 * Shell de la aplicación autenticada - mediCitas web
 * Navegación diferenciada por rol según specs/web/shell/spec.md.
 * Los módulos aún no construidos (F3+) aparecen deshabilitados.
 */
import { useRouter } from "next/navigation";
import { appUrl } from "@/shared/api/client-url";
import { useSession } from "@/shared/auth/session-context";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  href?: string;
  disabled?: boolean;
}

const NAV_POR_ROL: Record<string, NavItem[]> = {
  PATIENT: [
    { label: "Inicio", href: "/inicio" },
    { label: "Agendar cita", href: "/citas/agendar" },
    { label: "Mis citas", href: "/mis-citas" },
    { label: "Mi perfil", href: "/perfil" },
  ],
  DOCTOR: [
    { label: "Agenda del día", href: "/agenda" },
    { label: "Mis citas", href: "/mis-citas", disabled: true },
    { label: "Mi perfil", href: "/perfil" },
  ],
  ADMIN: [
    { label: "Panel de administración", href: "/administracion" },
    { label: "Horarios", href: "/administracion/horarios" },
    { label: "Citas", href: "/administracion/citas" },
    { label: "Mi perfil", href: "/perfil" },
  ],
  EMPLOYEE: [
    { label: "Gestión de citas", href: "/gestion-citas" },
    { label: "Mi perfil", href: "/perfil" },
  ],
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const user = useSession();
  const router = useRouter();

  // Combina las opciones de todos los roles activos (sin duplicados)
  const items = new Map<string, NavItem>();
  for (const rol of user.roles) {
    for (const item of NAV_POR_ROL[rol] ?? []) {
      if (!items.has(item.label)) items.set(item.label, item);
    }
  }

  const logout = async () => {
    await fetch(appUrl("/api/auth/session"), { method: "DELETE" }).catch(
      () => undefined
    );
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="min-h-dvh">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <span className="font-semibold">mediCitas</span>
          <nav aria-label="Navegación principal" data-testid="nav-principal">
            <ul className="flex flex-wrap items-center gap-1">
              {[...items.values()].map((item) => (
                <li key={item.label}>
                  {item.disabled ? (
                    <span
                      aria-disabled="true"
                      title="Disponible próximamente"
                      className="rounded-md px-3 py-1.5 text-sm text-muted-foreground"
                    >
                      {item.label}
                    </span>
                  ) : (
                    <a
                      href={item.href}
                      className="rounded-md px-3 py-1.5 text-sm hover:bg-accent"
                    >
                      {item.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </nav>
          <span className="ml-auto text-sm text-muted-foreground">
            {user.email}
          </span>
          <Button variant="outline" size="sm" onClick={logout} data-testid="logout-boton">
            Salir
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
