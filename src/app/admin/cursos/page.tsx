"use client";

import { FormEvent, useEffect, useState } from "react";

interface Curso {
  id: string;
  nombre: string;
  codigo: string;
  docente: { nombre: string; email: string };
  _count: { inscripciones: number; periodos: number };
}

interface Estudiante {
  id: string;
  nombre: string;
  email: string;
}

export default function AdminCursosPage() {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [cursoId, setCursoId] = useState("");
  const [estudianteId, setEstudianteId] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    const [resCursos, resEst] = await Promise.all([
      fetch("/api/admin/cursos"),
      fetch("/api/admin/estudiantes"),
    ]);
    const dataCursos = await resCursos.json();
    const dataEst = await resEst.json();
    setCursos(dataCursos.cursos ?? []);
    setEstudiantes(dataEst.estudiantes ?? []);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function inscribir(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMensaje(null);
    if (!cursoId || !estudianteId) {
      setError("Selecciona un curso y un estudiante.");
      return;
    }

    const res = await fetch(`/api/admin/cursos/${cursoId}/inscribir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estudianteId }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "No se pudo matricular al estudiante.");
      return;
    }

    setMensaje("Estudiante matriculado.");
    cargar();
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Cursos de la plataforma</h1>
        <p className="mt-1 text-slate-600">Supervisión de todos los cursos, sin importar el docente dueño.</p>
      </div>

      <form onSubmit={inscribir} className="card flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[220px]">
          <label className="label">Curso</label>
          <select className="input" value={cursoId} onChange={(e) => setCursoId(e.target.value)}>
            <option value="">Selecciona un curso</option>
            {cursos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} ({c.codigo})
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="label">Estudiante</label>
          <select className="input" value={estudianteId} onChange={(e) => setEstudianteId(e.target.value)}>
            <option value="">Selecciona un estudiante</option>
            {estudiantes.map((est) => (
              <option key={est.id} value={est.id}>
                {est.nombre} ({est.email})
              </option>
            ))}
          </select>
        </div>
        <button className="btn-primary">Matricular</button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
        {mensaje && <p className="w-full text-sm text-emerald-600">{mensaje}</p>}
      </form>

      <div className="card">
        <h2 className="font-semibold">Cursos ({cursos.length})</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-1">Nombre</th>
              <th>Código</th>
              <th>Docente</th>
              <th>Estudiantes</th>
              <th>Periodos</th>
            </tr>
          </thead>
          <tbody>
            {cursos.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="py-2">{c.nombre}</td>
                <td>{c.codigo}</td>
                <td className="text-slate-500">{c.docente.nombre}</td>
                <td>{c._count.inscripciones}</td>
                <td>{c._count.periodos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
