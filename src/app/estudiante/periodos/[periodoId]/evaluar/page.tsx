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
  aplicaAutoevaluacion: boolean;
  aplicaCoevaluacion: boolean;
}

interface Pendientes {
  periodo: { id: string; nombre: string; estado: string };
  rubrica: { id: string; escalaMin: number; escalaMax: number; criterios: Criterio[] };
  grupoId: string;
  grupoNombre: string;
  objetivos: {
    estudianteId: string;
    nombre: string;
    esUnoMismo: boolean;
    tipo: "AUTOEVALUACION" | "COEVALUACION";
    completado: boolean;
  }[];
}

export default function EvaluarEstudiantePage() {
  const { periodoId } = useParams<{ periodoId: string }>();
  const [datos, setDatos] = useState<Pendientes | null>(null);
  const [objetivoActivo, setObjetivoActivo] = useState<Pendientes["objetivos"][number] | null>(null);
  const [puntajes, setPuntajes] = useState<Record<string, number>>({});
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function cargar() {
    const res = await fetch(`/api/estudiante/periodos/${periodoId}/pendientes`);
    const data = await res.json();
    if (!res.ok) {
      setErrorCarga(data.error ?? "No se pudo cargar la evaluación.");
      return;
    }
    setDatos(data);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoId]);

  // Solo se muestran/exigen los criterios aplicables al tipo de evaluación
  // activa (autoevaluación o coevaluación); un criterio puede estar
  // restringido a solo una de las dos.
  const criteriosAplicables = useMemo(() => {
    if (!datos || !objetivoActivo) return [];
    return datos.rubrica.criterios.filter((c) =>
      objetivoActivo.tipo === "AUTOEVALUACION" ? c.aplicaAutoevaluacion : c.aplicaCoevaluacion
    );
  }, [datos, objetivoActivo]);

  function abrirObjetivo(obj: Pendientes["objetivos"][number]) {
    setObjetivoActivo(obj);
    setPuntajes({});
    setComentario("");
    setError(null);
    setMensaje(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!datos || !objetivoActivo) return;
    setError(null);

    if (criteriosAplicables.some((c) => puntajes[c.id] === undefined)) {
      setError("Debes calificar todos los criterios.");
      return;
    }

    setEnviando(true);
    const res = await fetch(`/api/periodos/${periodoId}/evaluaciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: objetivoActivo.tipo,
        evaluadoId: objetivoActivo.estudianteId,
        grupoId: datos.grupoId,
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

    setMensaje("¡Evaluación enviada!");
    setObjetivoActivo(null);
    cargar();
  }

  if (errorCarga) {
    return (
      <div className="flex flex-col gap-4">
        <VolverLink href="/estudiante" texto="Volver a mis secciones" />
        <div className="card border-amber-200 bg-amber-50 text-amber-800">{errorCarga}</div>
      </div>
    );
  }

  if (!datos) return <p className="text-slate-500">Cargando...</p>;

  if (datos.periodo.estado !== "ABIERTO") {
    return <div className="card">Este periodo no está abierto para evaluación.</div>;
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <VolverLink href="/estudiante" texto="Volver a mis cursos" />
        <h1 className="mt-2 text-2xl font-bold">{datos.periodo.nombre}</h1>
        <p className="mt-1 text-slate-600">Equipo: {datos.grupoNombre}</p>
      </div>

      {mensaje && <p className="text-sm text-emerald-600">{mensaje}</p>}

      <div className="card">
        <h2 className="font-semibold">Pendientes por evaluar</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {datos.objetivos.map((o) => (
            <li
              key={o.estudianteId}
              className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
            >
              <div>
                <p className="font-medium">
                  {o.esUnoMismo ? `${o.nombre} (tú)` : o.nombre}
                </p>
                <p className="text-xs text-slate-500">
                  {o.tipo === "AUTOEVALUACION" ? "Autoevaluación" : "Coevaluación"}
                  {o.completado ? " · completada" : ""}
                </p>
              </div>
              <button className={o.completado ? "btn-secondary" : "btn-primary"} onClick={() => abrirObjetivo(o)}>
                {o.completado ? "Editar" : "Evaluar"}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {objetivoActivo && (
        <form onSubmit={onSubmit} className="card flex flex-col gap-4">
          <h2 className="font-semibold">
            {objetivoActivo.tipo === "AUTOEVALUACION" ? "Autoevaluación" : `Coevaluación de ${objetivoActivo.nombre}`}
          </h2>
          {criteriosAplicables.map((c) => (
            <div key={c.id} className="flex flex-col gap-1 border-b border-slate-100 pb-3">
              <span className="text-sm font-medium">
                {c.nombre} <span className="text-slate-400">({c.ponderacion}%)</span>
              </span>
              {c.descripcion && <p className="text-xs text-slate-500">{c.descripcion}</p>}
              <EscalaRating
                escalaMin={datos.rubrica.escalaMin}
                escalaMax={datos.rubrica.escalaMax}
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
          <div className="flex gap-2">
            <button className="btn-primary" disabled={enviando}>
              {enviando ? "Guardando..." : "Enviar evaluación"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setObjetivoActivo(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
