import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL && process.env.NEXT_PUBLIC_SITE_URL.trim() !== "" ? process.env.NEXT_PUBLIC_SITE_URL : "https://medicitas.example.com");
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/registro", "/olvide-contrasena", "/restablecer"],
        disallow: ["/api/", "/administracion/", "/agenda", "/gestion-citas", "/mis-citas", "/perfil", "/citas/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
