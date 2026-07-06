"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { VolverLink } from "@/components/VolverLink";
import { EscalaRating } from "@/components/EscalaRating";

interface Criterio {
  id: string;
  nombre: string;
  descripcion?: string | null;
  ponderacion: number;
  aplicaDocente: boolean;
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
  comentario: string | null;
  detalles: { criterioId: string; puntaje: number }[];
}

export default function EvaluarDocentePage() {
  const { id, seccionId, evalId } = useParams<{ id: string; seccionId: string; evalId: string }>();
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
    const [resPeriodo, resGrupos, resEval] = await Promise.all([
      fetch(`/api/periodos/${evalId}`),
      fetch(`/api/periodos/${evalId}/grupos`),
      fetch(`/api/periodos/${evalId}/evaluaciones`),
    ]);
    const dataPeriodo = await resPeriodo.json();
    const dataGrupos = await resGrupos.json();
    const dataEval = await resEval.json();
    setPeriodo(dataPeriodo.periodo);
    setGrupos(dataGrupos.grupos ?? []);
    setEvaluaciones(dataEval.evaluaciones ?? []);
  }

  useEffect(() => {
    cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evalId]);

  const grupoActual = grupos.find((g) => g.id === grupoId);

  // Solo se muestran/exigen los criterios marcados como aplicables a DOCENTE.
  const criteriosAplicables = useMemo(
    () => periodo?.rubrica.criterios.filter((c) => c.aplicaDocente) ?? [],
    [periodo]
  );

  // "Ya evaluado" se marca por evaluadoId sin distinguir evaluador: si eres
  // titular o coevaluador y ya calificaste a este estudiante, se muestra tu
  // propia evaluación (cada evaluador solo ve/edita la suya, vía evaluadorId
  // implícito en el backend).
  const yaEvaluado = useMemo(
    () => new Set(evaluaciones.filter((e) => e.tipo === "DOCENTE").map((e) => e.evaluadoId)),
    [evaluaciones]
  );

  // El comentario (igual que los puntajes) es propio de cada estudiante: al
  // cambiar de estudiante dentro del mismo equipo hay que recargar el suyo
  // (o dejarlo vacío si aún no lo has evaluado), nunca conservar el que
  // estabas escribiendo para el estudiante anterior.
  function seleccionarEstudiante(estId: string) {
    setEstudianteId(estId);
    setMensaje(null);
    setError(null);
    const existente = evaluaciones.find((e) => e.tipo === "DOCENTE" && e.evaluadoId === estId);
    if (existente) {
      const nuevo: Record<string, number> = {};
      existente.detalles.forEach((d) => (nuevo[d.criterioId] = d.puntaje));
      setPuntajes(nuevo);
      setComentario(existente.comentario ?? "");
    } else {
      setPuntajes({});
      setComentario("");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMensaje(null);

    if (!periodo) return;
    if (criteriosAplicables.some((c) => puntajes[c.id] === undefined)) {
      setError("Debes calificar todos los criterios.");
      return;
    }

    setEnviando(true);
    const res = await fetch(`/api/periodos/${evalId}/evaluaciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "DOCENTE",
        evaluadoId: estudianteId,
        grupoId,
        comentario,
        detalles: criteriosAplicables.map((c) => ({ criterioId: c.id, puntaje: puntajes[c.id] })),
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

  const volverHref = `/docente/asignaturas/${id}/secciones/${seccionId}/evaluaciones`;

  if (!periodo) return <p className="text-slate-500">Cargando...</p>;

  if (periodo.estado !== "ABIERTO") {
    return (
      <div className="flex flex-col gap-4">
        <VolverLink href={volverHref} texto="Volver a evaluaciones" />
        <div className="card">
          <p>Esta evaluación no está abierta ({periodo.estado}). Solo puedes calificar mientras está abierta.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <VolverLink href={volverHref} texto="Volver a evaluaciones" />
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
          {grupos.length === 0 && (
            <p className="mt-1 text-xs text-amber-600">
              Esta evaluación todavía no tiene equipos. Créalos desde &quot;Equipos&quot; en la lista de
              evaluaciones.
            </p>
          )}
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
          {criteriosAplicables.map((c) => (
            <div key={c.id} className="flex flex-col gap-1 border-b border-slate-100 pb-3">
              <div className="flex justify-between text-sm">
                <span className="font-medium">
                  {c.nombre} <span className="text-slate-400">({c.ponderacion}%)</span>
                </span>
              </div>
              {c.descripcion && <p className="text-xs text-slate-500">{c.descripcion}</p>}
              <EscalaRating
                escalaMin={periodo.rubrica.escalaMin}
                escalaMax={periodo.rubrica.escalaMax}
                valor={puntajes[c.id]}
                onChange={(v) => setPuntajes((prev) => ({ ...prev, [c.id]: v }))}
              />
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
