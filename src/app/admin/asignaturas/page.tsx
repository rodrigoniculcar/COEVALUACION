"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

interface Seccion {
  id: string;
  nombre: string;
  periodoAcademico: { nombre: string };
  _count: { inscripciones: number; evaluaciones: number };
}

interface Asignatura {
  id: string;
  nombre: string;
  codigo: string;
  docente: { nombre: string; email: string };
  secciones: Seccion[];
}

interface Estudiante {
  id: string;
  nombre: string;
  email: string;
}

export default function AdminAsignaturasPage() {
  const [asignaturas, setAsignaturas] = useState<Asignatura[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [asignaturaId, setAsignaturaId] = useState("");
  const [seccionId, setSeccionId] = useState("");
  const [estudianteId, setEstudianteId] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    const [resAsig, resEst] = await Promise.all([
      fetch("/api/admin/asignaturas"),
      fetch("/api/admin/estudiantes"),
    ]);
    const dataAsig = await resAsig.json();
    const dataEst = await resEst.json();
    setAsignaturas(dataAsig.asignaturas ?? []);
    setEstudiantes(dataEst.estudiantes ?? []);
  }

  useEffect(() => {
    cargar();
  }, []);

  const asignaturaSeleccionada = asignaturas.find((a) => a.id === asignaturaId);
  const totalSecciones = useMemo(() => asignaturas.reduce((acc, a) => acc + a.secciones.length, 0), [asignaturas]);

  async function inscribir(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMensaje(null);
    if (!seccionId || !estudianteId) {
      setError("Selecciona una asignatura, una sección y un estudiante.");
      return;
    }

    const res = await fetch(`/api/admin/secciones/${seccionId}/inscribir`, {
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
        <h1 className="text-2xl font-bold">Asignaturas de la plataforma</h1>
        <p className="mt-1 text-slate-600">
          Supervisión de todas las asignaturas y secciones, sin importar el docente dueño.
        </p>
      </div>

      <form onSubmit={inscribir} className="card flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[220px]">
          <label className="label">Asignatura</label>
          <select
            className="input"
            value={asignaturaId}
            onChange={(e) => {
              setAsignaturaId(e.target.value);
              setSeccionId("");
            }}
          >
            <option value="">Selecciona una asignatura</option>
            {asignaturas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre} ({a.codigo})
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="label">Sección</label>
          <select
            className="input"
            value={seccionId}
            onChange={(e) => setSeccionId(e.target.value)}
            disabled={!asignaturaSeleccionada}
          >
            <option value="">Selecciona una sección</option>
            {asignaturaSeleccionada?.secciones.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre} ({s.periodoAcademico.nombre})
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
        <h2 className="font-semibold">
          Asignaturas ({asignaturas.length}) · {totalSecciones} secciones
        </h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-1">Nombre</th>
              <th>Código</th>
              <th>Docente</th>
              <th>Secciones</th>
            </tr>
          </thead>
          <tbody>
            {asignaturas.map((a) => (
              <tr key={a.id} className="border-t border-slate-100 align-top">
                <td className="py-2">{a.nombre}</td>
                <td>{a.codigo}</td>
                <td className="text-slate-500">{a.docente.nombre}</td>
                <td>
                  {a.secciones.length === 0 ? (
                    <span className="text-slate-400">Sin secciones</span>
                  ) : (
                    <ul className="flex flex-col gap-0.5">
                      {a.secciones.map((s) => (
                        <li key={s.id} className="text-xs text-slate-500">
                          {s.nombre} ({s.periodoAcademico.nombre}) · {s._count.inscripciones} estudiantes ·{" "}
                          {s._count.evaluaciones} evaluaciones
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
