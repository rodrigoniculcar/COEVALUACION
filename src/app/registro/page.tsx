"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";

export default function RegistroPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);

    const res = await fetch("/api/auth/registro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo crear la cuenta.");
      setCargando(false);
      return;
    }

    const resultado = await signIn("credentials", { email, password, redirect: false });
    setCargando(false);

    if (resultado?.error) {
      router.push("/login");
      return;
    }
    // El registro público siempre crea una cuenta docente.
    router.push("/docente");
    router.refresh();
  }

  return (
    <AuthShell>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Crear cuenta docente</h1>
        <p className="mt-2 text-sm text-slate-500">
          Los estudiantes no se registran aquí: el docente los carga desde su curso.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div>
          <label className="label" htmlFor="nombre">
            Nombre completo
          </label>
          <input
            id="nombre"
            autoComplete="name"
            required
            className="input"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="email">
            Correo electrónico
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Contraseña (mínimo 8 caracteres)
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="btn-primary mt-2 w-full py-2.5" disabled={cargando}>
          {cargando ? "Creando..." : "Crear cuenta"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-500">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Inicia sesión
        </Link>
      </p>
    </AuthShell>
  );
}
