import type { ReactNode } from "react";
import Image from "next/image";

const beneficios = [
  "Autoevaluación y coevaluación entre compañeros de equipo",
  "Evaluación docente bajo la misma rúbrica ponderada",
  "Panel de resultados con gráficos, radar y reportes descargables",
];

// Layout compartido de las pantallas de acceso (login / registro): un panel
// de marca a la izquierda (foto + overlay de gradiente + resumen del
// producto) y el formulario a la derecha. En pantallas angostas el panel de
// marca se oculta y solo se ve el formulario centrado.
export function AuthShell({
  children,
  imagenFondo,
}: {
  children: ReactNode;
  imagenFondo: string;
}) {
  return (
    <div className="flex min-h-screen bg-white">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-12 text-white lg:flex">
        <Image
          src={imagenFondo}
          alt=""
          fill
          priority
          className="object-cover"
          sizes="50vw"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-700/90 via-brand-600/85 to-brand-700/95" />
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-white/10 blur-3xl" />

        <div className="relative z-10 text-xl font-bold tracking-tight">Coevaluación</div>

        <div className="relative z-10 flex max-w-md flex-col gap-6">
          <h1 className="text-4xl font-bold leading-tight drop-shadow-sm">
            Autoevaluación y Coevaluación grupal
          </h1>
          <p className="text-lg text-brand-50/90">
            Rúbricas ponderadas, retroalimentación automática y datos claros para tomar mejores
            decisiones sobre el trabajo en equipo.
          </p>
          <ul className="flex flex-col gap-3">
            {beneficios.map((b) => (
              <li key={b} className="flex items-start gap-3 text-sm text-brand-50/90">
                <svg
                  className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-100"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {b}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 text-xs text-brand-100/70">
          © {new Date().getFullYear()} Coevaluación — plataforma de evaluación entre pares
        </div>
      </div>

      <div className="flex w-full flex-col justify-center px-6 py-16 sm:px-10 lg:w-1/2 lg:px-16 xl:px-24">
        <div className="mb-8 text-xl font-bold tracking-tight text-brand-600 lg:hidden">Coevaluación</div>
        <div className="mx-auto w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
