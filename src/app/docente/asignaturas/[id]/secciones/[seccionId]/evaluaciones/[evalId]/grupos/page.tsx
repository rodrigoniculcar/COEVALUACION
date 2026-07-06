"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { VolverLink } from "@/components/VolverLink";

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

export default function GruposEvaluacionPage() {
  const { id, seccionId, evalId } = useParams<{ id: string; seccionId: string; evalId: string }>();
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [nombre, setNombre] = useState("");
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombreEdicion, setNombreEdicion] = useState("");
  const [seleccionadosEdicion, setSeleccionadosEdicion] = useState<string[]>([]);
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  async function cargarTodo() {
    const [resEst, resGrupos] = await Promise.all([
      fetch(`/api/secciones/${seccionId}/estudiantes`),
      fetch(`/api/periodos/${evalId}/grupos`),
    ]);
    const dataEst = await resEst.json();
    const dataGrupos = await resGrupos.json();
    setEstudiantes((dataEst.inscripciones ?? []).map((i: { estudiante: Estudiante }) => i.estudiante));
    setGrupos(dataGrupos.grupos ?? []);
  }

  useEffect(() => {
    cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seccionId, evalId]);

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
    const res = await fetch(`/api/periodos/${evalId}/grupos`, {
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

  function iniciarEdicion(g: Grupo) {
    setEditandoId(g.id);
    setNombreEdicion(g.nombre);
    setSeleccionadosEdicion(g.miembros.map((m) => m.estudiante.id));
    setErrorEdicion(null);
  }

  function toggleSeleccionadoEdicion(estId: string) {
    setSeleccionadosEdicion((prev) => (prev.includes(estId) ? prev.filter((x) => x !== estId) : [...prev, estId]));
  }

  async function guardarEdicion(grupoId: string) {
    setErrorEdicion(null);
    if (seleccionadosEdicion.length === 0) {
      setErrorEdicion("El equipo debe tener al menos un integrante.");
      return;
    }
    setGuardandoEdicion(true);
    const res = await fetch(`/api/grupos/${grupoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombreEdicion, estudianteIds: seleccionadosEdicion }),
    });
    const data = await res.json();
    setGuardandoEdicion(false);

    if (!res.ok) {
      setErrorEdicion(data.error ?? "No se pudo guardar el equipo.");
      return;
    }
    setEditandoId(null);
    cargarTodo();
  }

  const idsAsignados = new Set(grupos.flatMap((g) => g.miembros.map((m) => m.estudiante.id)));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <VolverLink
          href={`/docente/asignaturas/${id}/secciones/${seccionId}/evaluaciones`}
          texto="Volver a evaluaciones"
        />
        <h1 className="mt-2 text-2xl font-bold">Equipos de esta evaluación</h1>
        <p className="mt-1 text-slate-600">
          Los equipos son propios de esta evaluación: puedes conformarlos distinto en cada evaluación de la
          misma sección. Los resultados ya calculados de otras evaluaciones conservan su propio equipo
          histórico, sin importar los cambios que hagas aquí.
        </p>
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
            {editandoId === g.id ? (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="label">Nombre del equipo</label>
                  <input
                    className="input"
                    value={nombreEdicion}
                    onChange={(e) => setNombreEdicion(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Integrantes</label>
                  <div className="grid max-h-48 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                    {estudiantes.map((est) => (
                      <label key={est.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={seleccionadosEdicion.includes(est.id)}
                          onChange={() => toggleSeleccionadoEdicion(est.id)}
                        />
                        {est.nombre}
                      </label>
                    ))}
                  </div>
                </div>
                {errorEdicion && <p className="text-sm text-red-600">{errorEdicion}</p>}
                <div className="flex gap-2">
                  <button
                    className="btn-primary"
                    onClick={() => guardarEdicion(g.id)}
                    disabled={guardandoEdicion}
                  >
                    {guardandoEdicion ? "Guardando..." : "Guardar"}
                  </button>
                  <button className="btn-secondary" onClick={() => setEditandoId(null)}>
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">{g.nombre}</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => iniciarEdicion(g)}
                      className="text-xs text-brand-600 hover:underline"
                    >
                      Editar
                    </button>
                    <button onClick={() => eliminarGrupo(g.id)} className="text-xs text-red-600 hover:underline">
                      Eliminar
                    </button>
                  </div>
                </div>
                <ul className="mt-2 text-sm text-slate-600">
                  {g.miembros.map((m) => (
                    <li key={m.estudiante.id}>{m.estudiante.nombre}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
