"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

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
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-bold">Crear cuenta docente</h1>
        <p className="mt-1 text-sm text-slate-600">
          Los estudiantes no se registran aquí: el docente los carga desde su curso.
        </p>
      </div>
      <form onSubmit={onSubmit} className="card flex flex-col gap-4">
        <div>
          <label className="label" htmlFor="nombre">
            Nombre completo
          </label>
          <input id="nombre" required className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
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
            Contraseña (mínimo 8 caracteres)
          </label>
          <input
            id="password"
            type="password"
            minLength={8}
            required
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="btn-primary" disabled={cargando}>
          {cargando ? "Creando..." : "Crear cuenta"}
        </button>
      </form>
    </main>
  );
}
