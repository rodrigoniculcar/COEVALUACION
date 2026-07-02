import Link from "next/link";
import { redirect } from "next/navigation";
import { getSesionActual } from "@/lib/session";

export default async function Home() {
  // La lectura de sesión se aísla en try/catch para que, si la configuración
  // de auth aún no está lista, la landing igual se muestre en vez de caer con
  // un "server-side exception". El redirect() debe quedar FUERA del try porque
  // internamente Next lo implementa lanzando una excepción de control.
  let session = null;
  try {
    session = await getSesionActual();
  } catch {
    session = null;
  }

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
