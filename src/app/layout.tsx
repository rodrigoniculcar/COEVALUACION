import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coevaluación | Plataforma de Autoevaluación y Coevaluación grupal",
  description: "Sistema de autoevaluación, coevaluación y evaluación docente con nota final ponderada.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
