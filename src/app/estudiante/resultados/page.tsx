"use client";

import { useEffect, useState } from "react";

interface CriterioResultado {
  criterioId: string;
  nombre: string;
  promedio: number;
  esPuntoCritico: boolean;
}

interface Resultado {
  periodoId: string;
  periodoNombre: string;
  cursoNombre: string;
  grupoNombre: string;
  notaAutoevaluacion: number | null;
  notaCoevaluacion: number | null;
  notaDocente: number | null;
  notaFinal: number;
  retroalimentacion: string;
  detalleCriterios: CriterioResultado[];
}

export default function ResultadosEstudiantePage() {
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch("/api/estudiante/resultados")
      .then((r) => r.json())
      .then((d) => {
        setResultados(d.resultados ?? []);
        setCargando(false);
      });
  }, []);

  if (cargando) return <p className="text-slate-500">Cargando...</p>;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Mis resultados</h1>
        <p className="mt-1 text-slate-600">
          Solo se muestran los periodos ya cerrados por el docente, con la nota final ponderada y retroalimentación.
        </p>
      </div>

      {resultados.length === 0 && <p className="text-slate-500">Aún no tienes resultados publicados.</p>}

      <div className="flex flex-col gap-6">
        {resultados.map((r) => (
          <div key={r.periodoId} className="card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold">
                  {r.cursoNombre} — {r.periodoNombre}
                </h2>
                <p className="text-sm text-slate-500">Equipo: {r.grupoNombre}</p>
              </div>
              <span className="rounded-full bg-brand-500 px-4 py-1 text-lg font-bold text-white">
                {r.notaFinal.toFixed(1)}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-4 text-center text-sm">
              <div>
                <p className="text-slate-500">Autoevaluación</p>
                <p className="text-lg font-semibold">{r.notaAutoevaluacion?.toFixed(1) ?? "—"}</p>
              </div>
              <div>
                <p className="text-slate-500">Coevaluación</p>
                <p className="text-lg font-semibold">{r.notaCoevaluacion?.toFixed(1) ?? "—"}</p>
              </div>
              <div>
                <p className="text-slate-500">Docente</p>
                <p className="text-lg font-semibold">{r.notaDocente?.toFixed(1) ?? "—"}</p>
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-semibold text-slate-700">Detalle por criterio</h3>
              <ul className="mt-2 flex flex-col gap-1">
                {r.detalleCriterios
                  .slice()
                  .sort((a, b) => a.promedio - b.promedio)
                  .map((c) => (
                    <li key={c.criterioId} className="flex items-center gap-2 text-sm">
                      <span className={`h-2 w-2 rounded-full ${c.esPuntoCritico ? "bg-red-500" : "bg-emerald-500"}`} />
                      <span className="flex-1">{c.nombre}</span>
                      <span className="font-medium">{c.promedio.toFixed(1)}</span>
                    </li>
                  ))}
              </ul>
            </div>

            <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{r.retroalimentacion}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
