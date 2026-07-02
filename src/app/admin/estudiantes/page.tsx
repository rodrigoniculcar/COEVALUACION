"use client";

import { FormEvent, useEffect, useState } from "react";

interface Estudiante {
  id: string;
  nombre: string;
  email: string;
  activo: boolean;
  _count: { inscripciones: number };
}

export default function AdminEstudiantesPage() {
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [passwordCreada, setPasswordCreada] = useState<{ email: string; password: string } | null>(null);

  async function cargar() {
    const res = await fetch("/api/admin/estudiantes");
    const data = await res.json();
    setEstudiantes(data.estudiantes ?? []);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function crearEstudiante(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPasswordCreada(null);
    setCargando(true);

    const res = await fetch("/api/admin/estudiantes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, email }),
    });
    const data = await res.json();
    setCargando(false);

    if (!res.ok) {
      setError(data.error ?? "No se pudo crear el estudiante.");
      return;
    }

    setPasswordCreada({ email: data.estudiante.email, password: data.passwordTemporal });
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
        <h1 className="text-2xl font-bold">Estudiantes</h1>
        <p className="mt-1 text-slate-600">
          Crea la cuenta del estudiante. La matrícula a un curso específico la hace el docente desde su curso, o
          tú desde <span className="font-medium">Cursos</span>.
        </p>
      </div>

      <form onSubmit={crearEstudiante} className="card flex flex-wrap items-end gap-4">
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
          {cargando ? "Creando..." : "Crear estudiante"}
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
        <h2 className="font-semibold">Estudiantes registrados ({estudiantes.length})</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-1">Nombre</th>
              <th>Correo</th>
              <th>Cursos inscritos</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {estudiantes.map((est) => (
              <tr key={est.id} className="border-t border-slate-100">
                <td className="py-2">{est.nombre}</td>
                <td className="text-slate-500">{est.email}</td>
                <td>{est._count.inscripciones}</td>
                <td>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      est.activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {est.activo ? "Activo" : "Desactivado"}
                  </span>
                </td>
                <td>
                  <button
                    className="text-xs text-brand-600 hover:underline"
                    onClick={() => toggleActivo(est.id, est.activo)}
                  >
                    {est.activo ? "Desactivar" : "Reactivar"}
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
