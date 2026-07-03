"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { VolverLink } from "@/components/VolverLink";

interface Criterio {
  id: string;
  nombre: string;
  descripcion?: string | null;
  ponderacion: number;
}

interface Periodo {
  id: string;
  nombre: string;
  estado: string;
  rubrica: { id: string; escalaMin: number; escalaMax: number; criterios: Criterio[] };
}

interface Miembro {
  estudiante: { id: string; nombre: string };
}

interface Grupo {
  id: string;
  nombre: string;
  miembros: Miembro[];
}

interface EvaluacionExistente {
  tipo: string;
  evaluadoId: string;
  detalles: { criterioId: string; puntaje: number }[];
}

export default function EvaluarDocentePage() {
  const { id, periodoId } = useParams<{ id: string; periodoId: string }>();
  const [periodo, setPeriodo] = useState<Periodo | null>(null);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionExistente[]>([]);
  const [grupoId, setGrupoId] = useState("");
  const [estudianteId, setEstudianteId] = useState("");
  const [puntajes, setPuntajes] = useState<Record<string, number>>({});
  const [comentario, setComentario] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function cargarTodo() {
    const [resPeriodo, resCurso, resEval] = await Promise.all([
      fetch(`/api/periodos/${periodoId}`),
      fetch(`/api/cursos/${id}`),
      fetch(`/api/periodos/${periodoId}/evaluaciones`),
    ]);
    const dataPeriodo = await resPeriodo.json();
    const dataCurso = await resCurso.json();
    const dataEval = await resEval.json();
    setPeriodo(dataPeriodo.periodo);
    setGrupos(dataCurso.curso?.grupos ?? []);
    setEvaluaciones(dataEval.evaluaciones ?? []);
  }

  useEffect(() => {
    cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, periodoId]);

  const grupoActual = grupos.find((g) => g.id === grupoId);

  const yaEvaluado = useMemo(
    () => new Set(evaluaciones.filter((e) => e.tipo === "DOCENTE").map((e) => e.evaluadoId)),
    [evaluaciones]
  );

  function seleccionarEstudiante(estId: string) {
    setEstudianteId(estId);
    setMensaje(null);
    setError(null);
    const existente = evaluaciones.find((e) => e.tipo === "DOCENTE" && e.evaluadoId === estId);
    if (existente) {
      const nuevo: Record<string, number> = {};
      existente.detalles.forEach((d) => (nuevo[d.criterioId] = d.puntaje));
      setPuntajes(nuevo);
    } else {
      setPuntajes({});
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMensaje(null);

    if (!periodo) return;
    const criterios = periodo.rubrica.criterios;
    if (criterios.some((c) => puntajes[c.id] === undefined)) {
      setError("Debes calificar todos los criterios.");
      return;
    }

    setEnviando(true);
    const res = await fetch(`/api/periodos/${periodoId}/evaluaciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "DOCENTE",
        evaluadoId: estudianteId,
        grupoId,
        comentario,
        detalles: criterios.map((c) => ({ criterioId: c.id, puntaje: puntajes[c.id] })),
      }),
    });
    const data = await res.json();
    setEnviando(false);

    if (!res.ok) {
      setError(data.error ?? "No se pudo guardar la evaluación.");
      return;
    }

    setMensaje("Evaluación guardada.");
    cargarTodo();
  }

  if (!periodo) return <p className="text-slate-500">Cargando...</p>;

  if (periodo.estado !== "ABIERTO") {
    return (
      <div className="flex flex-col gap-4">
        <VolverLink href={`/docente/cursos/${id}/periodos`} texto="Volver a periodos" />
        <div className="card">
          <p>Este periodo no está abierto ({periodo.estado}). Solo puedes evaluar mientras el periodo está abierto.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <VolverLink href={`/docente/cursos/${id}/periodos`} texto="Volver a periodos" />
        <h1 className="mt-2 text-2xl font-bold">Evaluación docente — {periodo.nombre}</h1>
        <p className="mt-1 text-slate-600">Selecciona un equipo y luego a cada estudiante para calificarlo.</p>
      </div>

      <div className="card flex flex-wrap gap-6">
        <div className="min-w-[220px]">
          <label className="label">Equipo</label>
          <select
            className="input"
            value={grupoId}
            onChange={(e) => {
              setGrupoId(e.target.value);
              setEstudianteId("");
            }}
          >
            <option value="">Selecciona un equipo</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nombre}
              </option>
            ))}
          </select>
        </div>
        {grupoActual && (
          <div className="min-w-[220px]">
            <label className="label">Estudiante</label>
            <div className="flex flex-col gap-1">
              {grupoActual.miembros.map((m) => (
                <button
                  key={m.estudiante.id}
                  type="button"
                  onClick={() => seleccionarEstudiante(m.estudiante.id)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm ${
                    estudianteId === m.estudiante.id ? "border-brand-500 bg-brand-50" : "border-slate-200"
                  }`}
                >
                  {m.estudiante.nombre}
                  {yaEvaluado.has(m.estudiante.id) && (
                    <span className="ml-2 text-xs text-emerald-600">✓ evaluado</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {estudianteId && (
        <form onSubmit={onSubmit} className="card flex flex-col gap-4">
          <h2 className="font-semibold">Rúbrica (escala {periodo.rubrica.escalaMin}-{periodo.rubrica.escalaMax})</h2>
          {periodo.rubrica.criterios.map((c) => (
            <div key={c.id} className="flex flex-col gap-1 border-b border-slate-100 pb-3">
              <div className="flex justify-between text-sm">
                <span className="font-medium">
                  {c.nombre} <span className="text-slate-400">({c.ponderacion}%)</span>
                </span>
              </div>
              {c.descripcion && <p className="text-xs text-slate-500">{c.descripcion}</p>}
              <input
                type="range"
                min={periodo.rubrica.escalaMin}
                max={periodo.rubrica.escalaMax}
                step={1}
                value={puntajes[c.id] ?? periodo.rubrica.escalaMin}
                onChange={(e) => setPuntajes((prev) => ({ ...prev, [c.id]: Number(e.target.value) }))}
              />
              <span className="text-sm text-slate-600">Puntaje: {puntajes[c.id] ?? periodo.rubrica.escalaMin}</span>
            </div>
          ))}
          <div>
            <label className="label">Comentario (opcional)</label>
            <textarea className="input" value={comentario} onChange={(e) => setComentario(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {mensaje && <p className="text-sm text-emerald-600">{mensaje}</p>}
          <button className="btn-primary self-start" disabled={enviando}>
            {enviando ? "Guardando..." : "Guardar evaluación"}
          </button>
        </form>
      )}
    </div>
  );
}
