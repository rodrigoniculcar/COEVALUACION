import Link from "next/link";
import { redirect } from "next/navigation";
import { getSesionActual } from "@/lib/session";

export default async function Home() {
  const session = await getSesionActual();

  if (session?.user) {
    redirect(session.user.rol === "DOCENTE" ? "/docente" : "/estudiante");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 px-6 text-center">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Autoevaluación y Coevaluación grupal</h1>
        <p className="mt-3 text-slate-600">
          Rúbricas ponderadas, autoevaluación, coevaluación entre pares y evaluación docente combinadas en
          una nota final, con panel de resultados y retroalimentación automática.
        </p>
      </div>
      <div className="flex gap-4">
        <Link href="/login" className="btn-primary">
          Iniciar sesión
        </Link>
        <Link href="/registro" className="btn-secondary">
          Crear cuenta docente
        </Link>
      </div>
    </main>
  );
}
