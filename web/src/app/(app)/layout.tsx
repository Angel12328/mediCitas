import { SessionProvider } from "@/shared/auth/session-context";
import { AppShell } from "@/components/layout/app-shell";
import { apiFetch } from "@/shared/api/api-client";
import { decodificarJwt } from "@/shared/auth/roles";

interface PerfilApi {
  id: string;
  email: string;
  roles: string[];
  person?: { fullName?: string };
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Fuente de verdad: perfil de la API. Respaldo: claims del JWT (UX).
  let user = { id: "", email: "", roles: [] as string[] };
  try {
    const perfil = await apiFetch<PerfilApi>("/api/v1/users/me");
    user = { id: perfil.id, email: perfil.email, roles: perfil.roles };
  } catch {
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    const claims = decodificarJwt(jar.get("mc_at")?.value);
    user = {
      id: claims?.sub ?? "",
      email: "",
      roles: claims?.roles ?? [],
    };
  }

  return (
    <SessionProvider user={user}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
