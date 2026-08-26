import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://medicitas.example.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "mediCitas — Gestión de citas médicas",
    template: "%s · mediCitas",
  },
  description:
    "Agenda, consulta y cancela citas médicas por especialidad, doctor y horario disponible. Para pacientes y consultorios en Honduras.",
  applicationName: "mediCitas",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "es_HN",
    url: siteUrl,
    siteName: "mediCitas",
    title: "mediCitas — Gestión de citas médicas",
    description:
      "Reserva tu cita médica en 3 pasos: especialidad, doctor y horario con cupos en tiempo real.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "mediCitas — agenda tu cita médica",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "mediCitas — Gestión de citas médicas",
    description: "Agenda y gestiona citas médicas por especialidad y doctor.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.ico",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "MedicalClinic",
      name: "mediCitas",
      description:
        "Plataforma para agendar citas médicas por especialidad, doctor y horario con cupos en tiempo real. Para pacientes y consultorios.",
      url: siteUrl,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Tegucigalpa",
        addressRegion: "Francisco Morazán",
        addressCountry: "HN",
      },
      availableLanguage: "es",
      potentialAction: {
        "@type": "ReserveAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${siteUrl}/citas/agendar`,
          actionPlatform: ["http://schema.org/DesktopWebPlatform", "http://schema.org/MobileWebPlatform"],
        },
        result: { "@type": "Reservation", name: "Cita médica" },
      },
    },
    {
      "@type": "WebSite",
      name: "mediCitas",
      url: siteUrl,
      inLanguage: "es-HN",
      potentialAction: {
        "@type": "SearchAction",
        target: `${siteUrl}/citas/agendar?query={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
