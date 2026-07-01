"use client";

import { Fragment, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface CriterioResultado {
  criterioId: string;
  nombre: string;
  promedio: number;
  esPuntoCritico: boolean;
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
  retroalimentacion: string;
  detalleCriterios: CriterioResultado[];
}

interface Equipo {
  grupoId: string;
  nombre: string;
  integrantes: number;
  notaPromedio: number;
  indicadoresMasBajos: { criterioId: string; nombre: string; promedio: number }[];
}

interface Respuesta {
  resumenCurso: {
    totalEstudiantes: number;
    notaPromedio: number;
    indicadoresMasBajos: { criterioId: string; nombre: string; promedio: number }[];
  };
  equipos: Equipo[];
  individuos: Individuo[];
}

export default function ResultadosDocentePage() {
  const { periodoId } = useParams<{ id: string; periodoId: string }>();
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/periodos/${periodoId}/resultados`)
      .then((r) => r.json())
      .then(setDatos);
  }, [periodoId]);

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
      <div>
        <h1 className="text-2xl font-bold">Panel de resultados</h1>
        <p className="mt-1 text-slate-600">
          Vista consolidada por curso, equipo e individuo, con los indicadores más bajos y retroalimentación
          automática.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-sm text-slate-500">Estudiantes evaluados</p>
          <p className="text-3xl font-bold">{datos.resumenCurso.totalEstudiantes}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Nota promedio del curso</p>
          <p className="text-3xl font-bold">{datos.resumenCurso.notaPromedio.toFixed(1)}</p>
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
              <p className="text-slate-500">Promedio: {e.notaPromedio.toFixed(1)}</p>
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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {datos.individuos
              .slice()
              .sort((a, b) => a.notaFinal - b.notaFinal)
              .map((i) => (
                <Fragment key={i.estudianteId}>
                  <tr className="border-t border-slate-100">
                    <td className="py-2">{i.nombre}</td>
                    <td>{i.grupoNombre}</td>
                    <td>{i.notaAutoevaluacion?.toFixed(1) ?? "—"}</td>
                    <td>{i.notaCoevaluacion?.toFixed(1) ?? "—"}</td>
                    <td>{i.notaDocente?.toFixed(1) ?? "—"}</td>
                    <td className="font-semibold">{i.notaFinal.toFixed(1)}</td>
                    <td>
                      <button
                        className="text-xs text-brand-600 hover:underline"
                        onClick={() => setExpandido(expandido === i.estudianteId ? null : i.estudianteId)}
                      >
                        {expandido === i.estudianteId ? "Ocultar" : "Detalle"}
                      </button>
                    </td>
                  </tr>
                  {expandido === i.estudianteId && (
                    <tr className="border-t border-slate-100 bg-slate-50">
                      <td colSpan={7} className="p-4">
                        <ul className="mb-3 flex flex-col gap-1">
                          {i.detalleCriterios
                            .slice()
                            .sort((a, b) => a.promedio - b.promedio)
                            .map((c) => (
                              <li key={c.criterioId} className="flex items-center gap-2">
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    c.esPuntoCritico ? "bg-red-500" : "bg-emerald-500"
                                  }`}
                                />
                                <span className="flex-1">{c.nombre}</span>
                                <span className="font-medium">{c.promedio.toFixed(1)}</span>
                              </li>
                            ))}
                        </ul>
                        <p className="text-slate-700">{i.retroalimentacion}</p>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
