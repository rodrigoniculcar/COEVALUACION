"use client";

import { FormEvent, useEffect, useState } from "react";

interface Docente {
  id: string;
  nombre: string;
  email: string;
  activo: boolean;
  _count: { cursosComoDocente: number };
}

export default function AdminDocentesPage() {
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [passwordCreada, setPasswordCreada] = useState<{ email: string; password: string } | null>(null);

  async function cargar() {
    const res = await fetch("/api/admin/docentes");
    const data = await res.json();
    setDocentes(data.docentes ?? []);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function crearDocente(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPasswordCreada(null);
    setCargando(true);

    const res = await fetch("/api/admin/docentes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, email }),
    });
    const data = await res.json();
    setCargando(false);

    if (!res.ok) {
      setError(data.error ?? "No se pudo crear el docente.");
      return;
    }

    setPasswordCreada({ email: data.docente.email, password: data.passwordTemporal });
    setNombre("");
    setEmail("");
    cargar();
  }

  async function toggleActivo(id: string, activo: boolean) {
    await fetch(`/api/admin/usuarios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !activo }),
    });
    cargar();
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Docentes</h1>
        <p className="mt-1 text-slate-600">Crea cuentas docente directamente, sin pasar por el registro público.</p>
      </div>

      <form onSubmit={crearDocente} className="card flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="label">Nombre completo</label>
          <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="label">Correo electrónico</label>
          <input
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <button className="btn-primary" disabled={cargando}>
          {cargando ? "Creando..." : "Crear docente"}
        </button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </form>

      {passwordCreada && (
        <div className="card border-amber-300 bg-amber-50">
          <p className="text-sm text-amber-800">
            Cuenta creada para <strong>{passwordCreada.email}</strong>. Copia esta contraseña temporal ahora: no
            se podrá volver a mostrar.
          </p>
          <p className="mt-2 font-mono text-lg">{passwordCreada.password}</p>
        </div>
      )}

      <div className="card">
        <h2 className="font-semibold">Docentes registrados ({docentes.length})</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-1">Nombre</th>
              <th>Correo</th>
              <th>Cursos</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {docentes.map((d) => (
              <tr key={d.id} className="border-t border-slate-100">
                <td className="py-2">{d.nombre}</td>
                <td className="text-slate-500">{d.email}</td>
                <td>{d._count.cursosComoDocente}</td>
                <td>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      d.activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {d.activo ? "Activo" : "Desactivado"}
                  </span>
                </td>
                <td>
                  <button
                    className="text-xs text-brand-600 hover:underline"
                    onClick={() => toggleActivo(d.id, d.activo)}
                  >
                    {d.activo ? "Desactivar" : "Reactivar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
