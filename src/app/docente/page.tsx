"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

interface Curso {
  id: string;
  nombre: string;
  codigo: string;
  _count: { inscripciones: number; periodos: number };
}

export default function DocenteDashboard() {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  async function cargarCursos() {
    const res = await fetch("/api/cursos");
    const data = await res.json();
    setCursos(data.cursos ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargarCursos();
  }, []);

  async function crearCurso(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/cursos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, codigo }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo crear el curso.");
      return;
    }
    setNombre("");
    setCodigo("");
    cargarCursos();
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Mis cursos</h1>
        <p className="mt-1 text-slate-600">Crea un curso para cargar estudiantes, equipos, rúbricas y periodos.</p>
      </div>

      <form onSubmit={crearCurso} className="card flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="label">Nombre del curso</label>
          <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </div>
        <div className="w-40">
          <label className="label">Código</label>
          <input className="input" value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
        </div>
        <button className="btn-primary" type="submit">
          Crear curso
        </button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </form>

      {cargando ? (
        <p className="text-slate-500">Cargando...</p>
      ) : cursos.length === 0 ? (
        <p className="text-slate-500">Aún no tienes cursos creados.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cursos.map((c) => (
            <Link key={c.id} href={`/docente/cursos/${c.id}`} className="card hover:border-brand-500">
              <h2 className="font-semibold">{c.nombre}</h2>
              <p className="text-sm text-slate-500">Código: {c.codigo}</p>
              <div className="mt-3 flex gap-4 text-xs text-slate-500">
                <span>{c._count.inscripciones} estudiantes</span>
                <span>{c._count.periodos} periodos</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
