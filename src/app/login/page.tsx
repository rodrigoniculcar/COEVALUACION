"use client";

import { FormEvent, useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";

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
    const destinoPorRol: Record<string, string> = {
      ADMINISTRADOR: "/admin",
      DOCENTE: "/docente",
      ESTUDIANTE: "/estudiante",
    };
    router.push(destinoPorRol[session?.user?.rol ?? ""] ?? "/estudiante");
    router.refresh();
  }

  return (
    <AuthShell imagenFondo="/login-bg.jpg">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Iniciar sesión</h1>
        <p className="mt-2 text-sm text-slate-500">Accede con tus credenciales de docente, estudiante o administrador.</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div>
          <label className="label" htmlFor="email">
            Correo electrónico
          </label>
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="input pl-9"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="password">
            Contraseña
          </label>
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v4h8z"
              />
            </svg>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              className="input pl-9"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="btn-primary mt-2 w-full py-2.5" disabled={cargando}>
          {cargando ? "Ingresando..." : "Ingresar"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-500">
        ¿Eres docente y no tienes cuenta?{" "}
        <Link href="/registro" className="font-medium text-brand-600 hover:text-brand-700">
          Regístrate
        </Link>
      </p>
    </AuthShell>
  );
}
