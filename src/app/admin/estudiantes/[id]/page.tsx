"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { VolverLink } from "@/components/VolverLink";
import { EditableText } from "@/components/EditableText";
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
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
  asignaturaNombre: string;
  seccionNombre: string;
  periodoAcademicoNombre: string;
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

interface Estudiante {
  id: string;
  rut: string | null;
  nombre: string;
  email: string;
  activo: boolean;
  createdAt: string;
}

export default function AdminEstudianteReportePage() {
  const { id } = useParams<{ id: string }>();
  const [estudiante, setEstudiante] = useState<Estudiante | null>(null);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/estudiantes/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setEstudiante(d.estudiante);
        setResultados(d.resultados ?? []);
      });
  }, [id]);

  async function exportarExcel() {
    setExportando(true);
    const XLSX = await import("xlsx");
    const filas = resultados.map((r) => ({
      "Año-semestre": r.periodoAcademicoNombre,
      Asignatura: r.asignaturaNombre,
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
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Resultados");
    XLSX.writeFile(libro, `resultados-${(estudiante?.nombre ?? "estudiante").replace(/\s+/g, "-").toLowerCase()}.xlsx`);
    setExportando(false);
  }

  if (!estudiante) return <p className="text-slate-500">Cargando...</p>;

  return (
    <div className="flex flex-col gap-8">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <VolverLink href="/admin/estudiantes" texto="Volver a estudiantes" />
          <h1 className="mt-2 text-2xl font-bold">
            <EditableText
              value={estudiante.nombre}
              onSave={async (nombre) => {
                const res = await fetch(`/api/admin/usuarios/${id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ nombre }),
                });
                if (!res.ok) throw new Error("No se pudo renombrar");
                setEstudiante((prev) => (prev ? { ...prev, nombre } : prev));
              }}
            />
          </h1>
          <p className="text-slate-500">
            {estudiante.email} {estudiante.rut && `· RUT ${estudiante.rut}`}
          </p>
          <span
            className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
              estudiante.activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
            }`}
          >
            {estudiante.activo ? "Activo" : "Desactivado"}
          </span>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={exportarExcel} disabled={exportando || resultados.length === 0}>
            {exportando ? "Generando..." : "Descargar Excel"}
          </button>
          <button className="btn-primary" onClick={() => window.print()} disabled={resultados.length === 0}>
            Descargar reporte (PDF)
          </button>
        </div>
      </div>

      <div className="hidden print:block">
        <h1 className="text-2xl font-bold">Reporte de resultados — {estudiante.nombre}</h1>
      </div>

      {resultados.length === 0 ? (
        <p className="text-slate-500">Este estudiante aún no tiene evaluaciones cerradas con resultados.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {resultados.map((r) => {
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
                      {r.asignaturaNombre} — {r.seccionNombre} ({r.periodoAcademicoNombre}) — {r.periodoNombre}
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

                <p className="mt-4 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                  {r.retroalimentacion}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
