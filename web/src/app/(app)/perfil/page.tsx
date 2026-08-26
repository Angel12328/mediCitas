import { redirect } from "next/navigation";
import { apiFetch } from "@/shared/api/api-client";
import { PerfilContenido } from "@/modules/profiles/components/perfil-contenido";
import type { PerfilResponse } from "@/modules/profiles/schemas";

export default async function PerfilPage() {
  let perfil: PerfilResponse;
  try {
    perfil = await apiFetch<PerfilResponse>("/api/v1/users/me");
  } catch {
    // Sesion invalida no recuperable: el middleware normalmente ya redirigio
    redirect("/login");
  }

  return <PerfilContenido perfil={perfil} />;
}
