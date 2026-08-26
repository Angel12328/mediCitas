import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://medicitas.example.com";
  const now = new Date();
  const publicRoutes = ["/", "/login", "/registro", "/olvide-contrasena", "/restablecer"] as const;
  return publicRoutes.map((route) => ({
    url: `${base}${route}`,
    lastModified: now,
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : route === "/login" || route === "/registro" ? 0.8 : 0.5,
  }));
}
