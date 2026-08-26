"use client";

/**
 * Contexto de sesión del usuario autenticado - mediCitas web
 * El valor proviene del servidor ((app)/layout.tsx vía /users/me).
 */
import { createContext, useContext, type ReactNode } from "react";

export interface SessionUser {
  id: string;
  email: string;
  roles: string[];
}

const SessionContext = createContext<SessionUser | null>(null);

export function SessionProvider({
  user,
  children,
}: {
  user: SessionUser;
  children: ReactNode;
}) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionUser {
  const user = useContext(SessionContext);
  if (!user) throw new Error("useSession debe usarse dentro de SessionProvider");
  return user;
}
