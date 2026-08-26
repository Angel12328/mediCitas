import { redirect } from "next/navigation";

/**
 * La raíz la resuelve el middleware (visitante → /login; sesión → inicio por
 * rol). Esta página solo cubre el caso de render directo sin middleware.
 */
export default function RootPage() {
  redirect("/login");
}
