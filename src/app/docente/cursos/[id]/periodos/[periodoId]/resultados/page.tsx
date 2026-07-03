"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { VolverLink } from "@/components/VolverLink";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
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

interface Individuo {
  estudianteId: string;
  nombre: string;
  email: string;
  grupoId: string;
  grupoNombre: string;
  notaAutoevaluacion: number | null;
  notaCoevaluacion: number | null;
  notaDocente: number | null;
  notaFinal: number;
  notaEscala1a7: number;
  retroalimentacion: string;
  detalleCriterios: CriterioResultado[];
}

interface Equipo {
  grupoId: string;
  nombre: string;
  integrantes: number;
  notaPromedio: number;
  notaEscala1a7Promedio: number;
  indicadoresMasBajos: { criterioId: string; nombre: string; promedio: number }[];
}

interface Respuesta {
  periodo: { nombre: string; escalaExigencia: number };
  resumenCurso: {
    totalEstudiantes: number;
    notaPromedio: number;
    notaEscala1a7Promedio: number;
    indicadoresMasBajos: { criterioId: string; nombre: string; promedio: number }[];
  };
  equipos: Equipo[];
  individuos: Individuo[];
}

export default function ResultadosDocentePage() {
  const { id, periodoId } = useParams<{ id: string; periodoId: string }>();
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    fetch(`/api/periodos/${periodoId}/resultados`)
      .then((r) => r.json())
      .then(setDatos);
  }, [periodoId]);

  function toggleExpandido(estudianteId: string) {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(estudianteId)) next.delete(estudianteId);
      else next.add(estudianteId);
      return next;
    });
  }

  function expandirTodos() {
    if (!datos) return;
    setExpandidos(new Set(datos.individuos.map((i) => i.estudianteId)));
  }

  function colapsarTodos() {
    setExpandidos(new Set());
  }

  async function exportarExcel() {
    if (!datos) return;
    setExportando(true);
    const XLSX = await import("xlsx");
    const filas = datos.individuos.map((i) => ({
      Estudiante: i.nombre,
      Correo: i.email,
      Equipo: i.grupoNombre,
      Autoevaluación: i.notaAutoevaluacion ?? "",
      Coevaluación: i.notaCoevaluacion ?? "",
      Docente: i.notaDocente ?? "",
      Final: Number(i.notaFinal.toFixed(1)),
      "Nota (1-7)": i.notaEscala1a7.toFixed(1),
    }));
    const hoja = XLSX.utils.json_to_sheet(filas);
    hoja["!cols"] = [
      { wch: 24 },
      { wch: 28 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
      { wch: 10 },
      { wch: 10 },
      { wch: 12 },
    ];
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Resultados");
    XLSX.writeFile(libro, `resultados-${datos.periodo.nombre.replace(/\s+/g, "-").toLowerCase()}.xlsx`);
    setExportando(false);
  }

  const dataRadarCurso = useMemo(() => {
    if (!datos) return [];
    const acumulado = new Map<
      string,
      { nombre: string; auto: number; co: number; doc: number; nAuto: number; nCo: number; nDoc: number }
    >();
    for (const ind of datos.individuos) {
      for (const c of ind.detalleCriterios) {
        const actual = acumulado.get(c.criterioId) ?? {
          nombre: c.nombre,
          auto: 0,
          co: 0,
          doc: 0,
          nAuto: 0,
          nCo: 0,
          nDoc: 0,
        };
        if (c.promedioAuto !== null) {
          actual.auto += c.promedioAuto;
          actual.nAuto += 1;
        }
        if (c.promedioCoevaluacion !== null) {
          actual.co += c.promedioCoevaluacion;
          actual.nCo += 1;
        }
        if (c.promedioDocente !== null) {
          actual.doc += c.promedioDocente;
          actual.nDoc += 1;
        }
        acumulado.set(c.criterioId, actual);
      }
    }
    return Array.from(acumulado.values()).map((v) => ({
      criterio: v.nombre,
      Autoevaluación: v.nAuto ? Number((v.auto / v.nAuto).toFixed(1)) : 0,
      Compañeros: v.nCo ? Number((v.co / v.nCo).toFixed(1)) : 0,
      Docente: v.nDoc ? Number((v.doc / v.nDoc).toFixed(1)) : 0,
    }));
  }, [datos]);

  if (!datos) return <p className="text-slate-500">Cargando resultados...</p>;

  const dataCurso = datos.resumenCurso.indicadoresMasBajos.map((i) => ({
    nombre: i.nombre,
    promedio: Number(i.promedio.toFixed(1)),
  }));

  const dataEquipos = datos.equipos.map((e) => ({
    nombre: e.nombre,
    promedio: Number(e.notaPromedio.toFixed(1)),
  }));

  return (
    <div className="flex flex-col gap-8">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <VolverLink href={`/docente/cursos/${id}/periodos`} texto="Volver a periodos" />
          <h1 className="mt-2 text-2xl font-bold">Panel de resultados</h1>
          <p className="mt-1 text-slate-600">
            Vista consolidada por curso, equipo e individuo, con los indicadores más bajos y retroalimentación
            automática.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={expandirTodos}>
            Expandir todos
          </button>
          <button className="btn-secondary" onClick={colapsarTodos}>
            Colapsar todos
          </button>
          <button className="btn-secondary" onClick={exportarExcel} disabled={exportando}>
            {exportando ? "Generando..." : "Descargar Excel"}
          </button>
          <button className="btn-primary" onClick={() => window.print()}>
            Descargar reporte (PDF)
          </button>
        </div>
      </div>

      <div className="hidden print:block">
        <h1 className="text-2xl font-bold">Panel de resultados — {datos.periodo.nombre}</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-sm text-slate-500">Estudiantes evaluados</p>
          <p className="text-3xl font-bold">{datos.resumenCurso.totalEstudiantes}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Nota promedio del curso</p>
          <p className="text-3xl font-bold">{datos.resumenCurso.notaPromedio.toFixed(1)}</p>
          <p className="text-xs text-slate-400">
            Escala 1-7: {datos.resumenCurso.notaEscala1a7Promedio.toFixed(1)} (exigencia {datos.periodo.escalaExigencia}%)
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Equipos</p>
          <p className="text-3xl font-bold">{datos.equipos.length}</p>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold">Puntos críticos del curso (indicadores más bajos)</h2>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dataCurso} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} />
              <YAxis type="category" dataKey="nombre" width={160} />
              <Tooltip />
              <Bar dataKey="promedio" fill="#3457d5" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold">Perfil del curso por criterio (auto / compañeros / docente)</h2>
        <div className="mt-4 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={dataRadarCurso}>
              <PolarGrid />
              <PolarAngleAxis dataKey="criterio" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis domain={[0, 100]} />
              <Radar name="Autoevaluación" dataKey="Autoevaluación" stroke="#3457d5" fill="#3457d5" fillOpacity={0.15} />
              <Radar name="Compañeros" dataKey="Compañeros" stroke="#10b981" fill="#10b981" fillOpacity={0.15} />
              <Radar name="Docente" dataKey="Docente" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} />
              <Legend />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold">Nota promedio por equipo</h2>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dataEquipos}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="nombre" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="promedio" fill="#3457d5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {datos.equipos.map((e) => (
            <div key={e.grupoId} className="rounded-lg border border-slate-200 p-3 text-sm">
              <p className="font-medium">
                {e.nombre} ({e.integrantes} integrantes)
              </p>
              <p className="text-slate-500">
                Promedio: {e.notaPromedio.toFixed(1)} · Escala 1-7: {e.notaEscala1a7Promedio.toFixed(1)}
              </p>
              <ul className="mt-1 text-xs text-slate-500">
                {e.indicadoresMasBajos.map((i) => (
                  <li key={i.criterioId}>
                    {i.nombre}: {i.promedio.toFixed(1)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold">Resultados individuales</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-1">Estudiante</th>
              <th>Equipo</th>
              <th>Auto</th>
              <th>Co</th>
              <th>Docente</th>
              <th>Final</th>
              <th>Nota (1-7)</th>
              <th className="no-print"></th>
            </tr>
          </thead>
          <tbody>
            {datos.individuos
              .slice()
              .sort((a, b) => a.notaFinal - b.notaFinal)
              .map((i) => {
                const expandido = expandidos.has(i.estudianteId);
                const datosRadarEstudiante = i.detalleCriterios.map((c) => ({
                  criterio: c.nombre,
                  Autoevaluación: c.promedioAuto ?? 0,
                  Compañeros: c.promedioCoevaluacion ?? 0,
                  Docente: c.promedioDocente ?? 0,
                }));

                return (
                  <Fragment key={i.estudianteId}>
                    <tr className="border-t border-slate-100">
                      <td className="py-2">{i.nombre}</td>
                      <td>{i.grupoNombre}</td>
                      <td>{i.notaAutoevaluacion?.toFixed(1) ?? "—"}</td>
                      <td>{i.notaCoevaluacion?.toFixed(1) ?? "—"}</td>
                      <td>{i.notaDocente?.toFixed(1) ?? "—"}</td>
                      <td className="font-semibold">{i.notaFinal.toFixed(1)}</td>
                      <td className="font-semibold">{i.notaEscala1a7.toFixed(1)}</td>
                      <td className="no-print">
                        <button
                          className="text-xs text-brand-600 hover:underline"
                          onClick={() => toggleExpandido(i.estudianteId)}
                        >
                          {expandido ? "Ocultar" : "Detalle"}
                        </button>
                      </td>
                    </tr>
                    {expandido && (
                      <tr className="border-t border-slate-100 bg-slate-50">
                        <td colSpan={8} className="p-4">
                          <div className="grid gap-4 lg:grid-cols-2">
                            <div>
                              <ul className="mb-3 flex flex-col gap-1">
                                {i.detalleCriterios
                                  .slice()
                                  .sort((a, b) => a.promedio - b.promedio)
                                  .map((c) => (
                                    <li key={c.criterioId} className="flex items-center gap-2">
                                      <span
                                        className={`h-2 w-2 rounded-full ${
                                          c.esPuntoCritico
                                            ? "bg-red-500"
                                            : c.esFortaleza
                                              ? "bg-emerald-500"
                                              : "bg-slate-400"
                                        }`}
                                      />
                                      <span className="flex-1">{c.nombre}</span>
                                      <span className="font-medium">{c.promedio.toFixed(1)}</span>
                                    </li>
                                  ))}
                              </ul>
                              <p className="whitespace-pre-line text-slate-700">{i.retroalimentacion}</p>
                            </div>
                            <div className="h-72">
                              <ResponsiveContainer width="100%" height="100%">
                                <RadarChart data={datosRadarEstudiante}>
                                  <PolarGrid />
                                  <PolarAngleAxis dataKey="criterio" tick={{ fontSize: 10 }} />
                                  <PolarRadiusAxis domain={[0, 100]} />
                                  <Radar
                                    name="Autoevaluación"
                                    dataKey="Autoevaluación"
                                    stroke="#3457d5"
                                    fill="#3457d5"
                                    fillOpacity={0.15}
                                  />
                                  <Radar
                                    name="Compañeros"
                                    dataKey="Compañeros"
                                    stroke="#10b981"
                                    fill="#10b981"
                                    fillOpacity={0.15}
                                  />
                                  <Radar name="Docente" dataKey="Docente" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} />
                                  <Legend />
                                </RadarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
