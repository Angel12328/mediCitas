/**
 * Utilidades compartidas para pruebas - mediCitas web
 */
import { QueryClient } from "@tanstack/react-query";

export function newQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: Infinity, gcTime: Infinity, retry: false },
    },
  });
}

/** Ejecuta axe-core sobre un contenedor jsdom y devuelve violaciones graves */
export async function violacionesGraves(contenedor: HTMLElement) {
  await import("axe-core");
  const axe = (window as unknown as {
    axe: {
      run: (
        el: Element,
        options?: Record<string, unknown>
      ) => Promise<{
        violations: Array<{ id: string; impact: string | null; nodes: unknown[] }>;
      }>;
    };
  }).axe;
  const results = await axe.run(contenedor, {
    runOnly: ["wcag2a", "wcag2aa", "cat.forms", "cat.name-role-value"],
  });
  // En jsdom el contraste de color no es calculable; se excluye explícitamente
  return results.violations.filter((v) => v.id !== "color-contrast");
}
