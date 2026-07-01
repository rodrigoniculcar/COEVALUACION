"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Estudiante {
  id: string;
  nombre: string;
  email: string;
}

interface Grupo {
  id: string;
  nombre: string;
  miembros: { estudiante: Estudiante }[];
}

export default function GruposPage() {
  const { id } = useParams<{ id: string }>();
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [nombre, setNombre] = useState("");
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function cargarTodo() {
    const [resEst, resGrupos] = await Promise.all([
      fetch(`/api/cursos/${id}/estudiantes`),
      fetch(`/api/cursos/${id}/grupos`),
    ]);
    const dataEst = await resEst.json();
    const dataGrupos = await resGrupos.json();
    setEstudiantes((dataEst.inscripciones ?? []).map((i: { estudiante: Estudiante }) => i.estudiante));
    setGrupos(dataGrupos.grupos ?? []);
  }

  useEffect(() => {
    cargarTodo();
  }, [id]);

  function toggleSeleccionado(estId: string) {
    setSeleccionados((prev) => (prev.includes(estId) ? prev.filter((x) => x !== estId) : [...prev, estId]));
  }

  async function crearGrupo(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (seleccionados.length === 0) {
      setError("Selecciona al menos un estudiante para el equipo.");
      return;
    }
    const res = await fetch(`/api/cursos/${id}/grupos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, estudianteIds: seleccionados }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "No se pudo crear el equipo.");
      return;
    }
    setNombre("");
    setSeleccionados([]);
    cargarTodo();
  }

  async function eliminarGrupo(grupoId: string) {
    if (!confirm("¿Eliminar este equipo? Esta acción no se puede deshacer.")) return;
    await fetch(`/api/grupos/${grupoId}`, { method: "DELETE" });
    cargarTodo();
  }

  const idsAsignados = new Set(grupos.flatMap((g) => g.miembros.map((m) => m.estudiante.id)));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Equipos de trabajo</h1>
        <p className="mt-1 text-slate-600">Agrupa a los estudiantes para la coevaluación entre pares.</p>
      </div>

      <form onSubmit={crearGrupo} className="card flex flex-col gap-4">
        <div>
          <label className="label">Nombre del equipo</label>
          <input className="input max-w-xs" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </div>
        <div>
          <label className="label">Integrantes</label>
          <div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
            {estudiantes.map((est) => (
              <label key={est.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={seleccionados.includes(est.id)}
                  onChange={() => toggleSeleccionado(est.id)}
                />
                <span>
                  {est.nombre}
                  {idsAsignados.has(est.id) && <span className="ml-1 text-xs text-amber-600">(ya en un equipo)</span>}
                </span>
              </label>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary self-start">Crear equipo</button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {grupos.map((g) => (
          <div key={g.id} className="card">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{g.nombre}</h2>
              <button onClick={() => eliminarGrupo(g.id)} className="text-xs text-red-600 hover:underline">
                Eliminar
              </button>
            </div>
            <ul className="mt-2 text-sm text-slate-600">
              {g.miembros.map((m) => (
                <li key={m.estudiante.id}>{m.estudiante.nombre}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
