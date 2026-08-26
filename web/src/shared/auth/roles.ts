/**
 * Utilidades de roles y rutas de inicio - mediCitas web
 * Compartido entre middleware (edge) y componentes cliente.
 */

export type Rol =
  | "PATIENT"
  | "DOCTOR"
  | "ADMIN"
  | "EMPLOYEE";

/** Prefijos privados por rol (además de las rutas comunes autenticadas).
 *  Nombres según el catálogo real del backend (prisma/seed.ts). */
export const RUTAS_POR_ROL: Record<Exclude<Rol, "PATIENT">, string> = {
  ADMIN: "/administracion",
  DOCTOR: "/agenda",
  EMPLOYEE: "/gestion-citas",
};

/** Página de inicio según los roles activos del usuario */
export function homeForRoles(roles: string[]): string {
  if (roles.includes("ADMIN")) return RUTAS_POR_ROL.ADMIN;
  if (roles.includes("DOCTOR")) return RUTAS_POR_ROL.DOCTOR;
  if (roles.includes("EMPLOYEE")) return RUTAS_POR_ROL.EMPLOYEE;
  return "/inicio";
}

/** El usuario posee alguno de los roles requeridos para el prefijo dado */
export function tieneAccesoARuta(roles: string[], pathname: string): boolean {
  for (const [rol, prefijo] of Object.entries(RUTAS_POR_ROL)) {
    if (pathname === prefijo || pathname.startsWith(`${prefijo}/`)) {
      return roles.includes(rol);
    }
  }
  return true; // rutas comunes autenticadas
}

export interface JwtClaims {
  sub?: string;
  roles?: string[];
  exp?: number;
}

/** Decodifica el payload de un JWT sin verificar firma (solo UX/guardas) */
export function decodificarJwt(token: string | undefined | null): JwtClaims | null {
  if (!token) return null;
  const partes = token.split(".");
  if (partes.length !== 3) return null;
  try {
    const json = atob(partes[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}

/** ¿El token expirará en los próximos `margenSegundos`? */
export function tokenExpiraPronto(token: string | undefined | null, margenSegundos = 30): boolean {
  const claims = decodificarJwt(token);
  if (!claims?.exp) return true;
  return claims.exp <= Math.floor(Date.now() / 1000) + margenSegundos;
}

/** Prefijos de rutas internas consideradas seguras para `?next=` */
const NEXT_SEGUROS = [
  "/inicio",
  "/administracion",
  "/agenda",
  "/gestion-citas",
  "/citas",
  "/mis-citas",
  "/perfil",
  "/sin-acceso",
] as const;

/** Valida que `next` sea una ruta interna conocida (previene open redirect) */
export function esNextSeguro(next: string | null): boolean {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return false;
  return NEXT_SEGUROS.some((prefijo) => next === prefijo || next.startsWith(`${prefijo}/`) || next.startsWith(`${prefijo}?`));
}
