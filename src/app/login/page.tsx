"use client";

import { FormEvent, useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);

    const resultado = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setCargando(false);

    if (resultado?.error) {
      setError("Correo o contraseña incorrectos.");
      return;
    }

    // Como la página de inicio ya no redirige, resolvemos aquí el destino
    // según el rol del usuario recién autenticado.
    const session = await getSession();
    const destino = session?.user?.rol === "DOCENTE" ? "/docente" : "/estudiante";
    router.push(destino);
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-bold">Iniciar sesión</h1>
        <p className="mt-1 text-sm text-slate-600">Accede con tus credenciales de docente o estudiante.</p>
      </div>
      <form onSubmit={onSubmit} className="card flex flex-col gap-4">
        <div>
          <label className="label" htmlFor="email">
            Correo electrónico
          </label>
          <input
            id="email"
            type="email"
            required
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            required
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="btn-primary" disabled={cargando}>
          {cargando ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
      <p className="text-center text-sm text-slate-600">
        ¿Eres docente y no tienes cuenta?{" "}
        <Link href="/registro" className="font-medium text-brand-600">
          Regístrate
        </Link>
      </p>
    </main>
  );
}
