import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Plataforma SaaS | Florería Farfalina & Alquiler Vestidos Carissma",
  description: "Sistema integral de gestión ERP, CRM, POS Omnicanal y Alquiler de Vestidos con Precios Dinámicos",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-[100dvh] bg-warm-50 text-warm-900 selection:bg-terracotta-100 selection:text-terracotta-700 antialiased">
        {children}
      </body>
    </html>
  );
}
