/**
 * Resuelve rutas internas para fetch del navegador - mediCitas web
 * En el servidor deja la ruta relativa; en el navegador la vuelve absoluta
 * (necesario para fetch en pruebas jsdom y consistencia en general).
 */
export function appUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}
