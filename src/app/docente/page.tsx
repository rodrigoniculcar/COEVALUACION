"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

interface Asignatura {
  id: string;
  nombre: string;
  codigo: string;
  _count: { secciones: number };
}

export default function DocenteDashboard() {
  const [asignaturas, setAsignaturas] = useState<Asignatura[]>([]);
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  async function cargarAsignaturas() {
    const res = await fetch("/api/asignaturas");
    const data = await res.json();
    setAsignaturas(data.asignaturas ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargarAsignaturas();
  }, []);

  async function crearAsignatura(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/asignaturas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, codigo }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo crear la asignatura.");
      return;
    }
    setNombre("");
    setCodigo("");
    cargarAsignaturas();
  }

  async function eliminarAsignatura(id: string, nombreAsignatura: string) {
    if (
      !confirm(
        `¿Eliminar la asignatura "${nombreAsignatura}"? Esto borra también todas sus secciones, estudiantes matriculados, evaluaciones, equipos y resultados. Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    setEliminandoId(id);
    await fetch(`/api/asignaturas/${id}`, { method: "DELETE" });
    setEliminandoId(null);
    cargarAsignaturas();
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Mis asignaturas</h1>
        <p className="mt-1 text-slate-600">
          Puedes tener varias asignaturas a cargo. Cada asignatura agrupa sus secciones (una por cada
          año-semestre en que se dicta).
        </p>
      </div>

      <form onSubmit={crearAsignatura} className="card flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="label">Nombre de la asignatura</label>
          <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </div>
        <div className="w-40">
          <label className="label">Código</label>
          <input className="input" value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
        </div>
        <button className="btn-primary" type="submit">
          Crear asignatura
        </button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </form>

      {cargando ? (
        <p className="text-slate-500">Cargando...</p>
      ) : asignaturas.length === 0 ? (
        <p className="text-slate-500">Aún no tienes asignaturas creadas.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {asignaturas.map((a) => (
            <div key={a.id} className="card hover:border-brand-500">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/docente/asignaturas/${a.id}`} className="flex-1">
                  <h2 className="font-semibold">{a.nombre}</h2>
                  <p className="text-sm text-slate-500">Código: {a.codigo}</p>
                  <div className="mt-3 flex gap-4 text-xs text-slate-500">
                    <span>{a._count.secciones} secciones</span>
                  </div>
                </Link>
                <button
                  className="text-xs text-red-600 hover:underline disabled:opacity-50"
                  onClick={() => eliminarAsignatura(a.id, a.nombre)}
                  disabled={eliminandoId === a.id}
                >
                  {eliminandoId === a.id ? "Eliminando..." : "Eliminar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
