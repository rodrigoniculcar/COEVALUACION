import Link from "next/link";

// Página de inicio estática: no consulta sesión ni base de datos, por lo que
// siempre se renderiza en Vercel aunque la auth o la DB no estén configuradas.
// La redirección al panel según el rol se hace tras iniciar sesión (login).
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="flex items-center justify-center gap-2 text-2xl font-bold tracking-tight">
        <span className="text-brand-500">Duoc</span>
        <span className="text-navy-600">UC</span>
        <span className="text-slate-400">· Coevaluación</span>
      </div>
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
