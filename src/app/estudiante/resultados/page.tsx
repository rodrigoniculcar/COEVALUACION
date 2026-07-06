"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

interface CriterioResultado {
  criterioId: string;
  nombre: string;
  promedio: number;
  promedioAuto: number | null;
  promedioCoevaluacion: number | null;
  promedioDocente: number | null;
  esPuntoCritico: boolean;
  esFortaleza: boolean;
}

interface Resultado {
  periodoId: string;
  periodoNombre: string;
  asignaturaId: string;
  asignaturaNombre: string;
  seccionId: string;
  seccionNombre: string;
  periodoAcademicoNombre: string;
  periodoAcademicoActual: boolean;
  grupoNombre: string;
  integrantesHistoricos: string[];
  notaAutoevaluacion: number | null;
  notaCoevaluacion: number | null;
  notaDocente: number | null;
  notaFinal: number;
  notaEscala1a7: number;
  retroalimentacion: string;
  detalleCriterios: CriterioResultado[];
}

interface GrupoAsignatura {
  asignaturaId: string;
  asignaturaNombre: string;
  resultados: Resultado[];
}

export default function ResultadosEstudiantePage() {
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarAnteriores, setMostrarAnteriores] = useState(false);
  const [imprimiendoId, setImprimiendoId] = useState<string | null>(null);
  const [exportandoId, setExportandoId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/estudiante/resultados")
      .then((r) => r.json())
      .then((d) => {
        setResultados(d.resultados ?? []);
        setCargando(false);
      });
  }, []);

  useEffect(() => {
    if (!imprimiendoId) return;
    const t = setTimeout(() => {
      window.print();
      setImprimiendoId(null);
    }, 100);
    return () => clearTimeout(t);
  }, [imprimiendoId]);

  const hayPeriodoActual = resultados.some((r) => r.periodoAcademicoActual);

  const resultadosFiltrados = useMemo(() => {
    if (mostrarAnteriores || !hayPeriodoActual) return resultados;
    return resultados.filter((r) => r.periodoAcademicoActual);
  }, [resultados, mostrarAnteriores, hayPeriodoActual]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, GrupoAsignatura>();
    for (const r of resultadosFiltrados) {
      const actual = mapa.get(r.asignaturaId) ?? {
        asignaturaId: r.asignaturaId,
        asignaturaNombre: r.asignaturaNombre,
        resultados: [],
      };
      actual.resultados.push(r);
      mapa.set(r.asignaturaId, actual);
    }
    return Array.from(mapa.values());
  }, [resultadosFiltrados]);

  const gruposAMostrar = imprimiendoId ? grupos.filter((g) => g.asignaturaId === imprimiendoId) : grupos;

  async function exportarExcel(grupo: GrupoAsignatura) {
    setExportandoId(grupo.asignaturaId);
    const XLSX = await import("xlsx");
    const filas = grupo.resultados.map((r) => ({
      "Año-semestre": r.periodoAcademicoNombre,
      Sección: r.seccionNombre,
      Evaluación: r.periodoNombre,
      Equipo: r.grupoNombre,
      Autoevaluación: r.notaAutoevaluacion ?? "",
      Coevaluación: r.notaCoevaluacion ?? "",
      Docente: r.notaDocente ?? "",
      "Final (%)": Number(r.notaFinal.toFixed(1)),
      "Nota (1-7)": r.notaEscala1a7.toFixed(1),
    }));
    const hoja = XLSX.utils.json_to_sheet(filas);
    hoja["!cols"] = [
      { wch: 14 },
      { wch: 16 },
      { wch: 20 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
    ];
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Resultados");
    XLSX.writeFile(libro, `resultados-${grupo.asignaturaNombre.replace(/\s+/g, "-").toLowerCase()}.xlsx`);
    setExportandoId(null);
  }

  if (cargando) return <p className="text-slate-500">Cargando...</p>;

  return (
    <div className="flex flex-col gap-8">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Mis resultados</h1>
          <p className="mt-1 text-slate-600">
            Solo se muestran las evaluaciones ya cerradas por el docente, agrupadas por asignatura y sección.
          </p>
        </div>
        {hayPeriodoActual && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={mostrarAnteriores}
              onChange={(e) => setMostrarAnteriores(e.target.checked)}
            />
            Ver semestres anteriores
          </label>
        )}
      </div>

      {resultados.length === 0 && <p className="text-slate-500">Aún no tienes resultados publicados.</p>}

      {resultados.length > 0 && grupos.length === 0 && (
        <p className="text-slate-500">
          No hay resultados para el periodo académico actual. Activa &quot;Ver semestres anteriores&quot; para
          revisar los de otros semestres.
        </p>
      )}

      <div className="flex flex-col gap-10">
        {gruposAMostrar.map((grupo) => (
          <section key={grupo.asignaturaId} className="flex flex-col gap-4">
            <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <h2 className="text-lg font-bold">{grupo.asignaturaNombre}</h2>
              <div className="flex gap-2">
                <button
                  className="btn-secondary"
                  onClick={() => exportarExcel(grupo)}
                  disabled={exportandoId === grupo.asignaturaId}
                >
                  {exportandoId === grupo.asignaturaId ? "Generando..." : "Descargar Excel"}
                </button>
                <button className="btn-primary" onClick={() => setImprimiendoId(grupo.asignaturaId)}>
                  Descargar PDF
                </button>
              </div>
            </div>
            <div className="hidden print:block">
              <h2 className="text-xl font-bold">{grupo.asignaturaNombre}</h2>
            </div>

            {grupo.resultados.map((r) => {
              const datosRadar = r.detalleCriterios.map((c) => ({
                criterio: c.nombre,
                Autoevaluación: c.promedioAuto ?? 0,
                Compañeros: c.promedioCoevaluacion ?? 0,
                Docente: c.promedioDocente ?? 0,
              }));

              return (
                <div key={r.periodoId} className="card">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">
                        {r.seccionNombre} ({r.periodoAcademicoNombre}) — {r.periodoNombre}
                      </h3>
                      <p className="text-sm text-slate-500">
                        Equipo: {r.grupoNombre}
                        {r.integrantesHistoricos.length > 0 && (
                          <span className="text-slate-400"> ({r.integrantesHistoricos.join(", ")})</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-brand-500 px-4 py-1 text-lg font-bold text-white">
                        {r.notaEscala1a7.toFixed(1)}
                      </span>
                      <span className="text-xs text-slate-500">({r.notaFinal.toFixed(1)}%)</span>
                    </div>
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

                  <div className="mt-4 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={datosRadar}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="criterio" tick={{ fontSize: 11 }} />
                        <PolarRadiusAxis domain={[0, 100]} />
                        <Radar name="Autoevaluación" dataKey="Autoevaluación" stroke="#f2790f" fill="#f2790f" fillOpacity={0.15} />
                        <Radar name="Compañeros" dataKey="Compañeros" stroke="#10b981" fill="#10b981" fillOpacity={0.15} />
                        <Radar name="Docente" dataKey="Docente" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} />
                        <Legend />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-slate-700">Detalle por criterio</h4>
                    <ul className="mt-2 flex flex-col gap-1">
                      {r.detalleCriterios
                        .slice()
                        .sort((a, b) => a.promedio - b.promedio)
                        .map((c) => (
                          <li key={c.criterioId} className="flex items-center gap-2 text-sm">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                c.esPuntoCritico ? "bg-red-500" : c.esFortaleza ? "bg-emerald-500" : "bg-slate-400"
                              }`}
                            />
                            <span className="flex-1">{c.nombre}</span>
                            <span className="font-medium">{c.promedio.toFixed(1)}</span>
                          </li>
                        ))}
                    </ul>
                  </div>

                  <p className="mt-4 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                    {r.retroalimentacion}
                  </p>
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
