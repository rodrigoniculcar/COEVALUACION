"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { VolverLink } from "@/components/VolverLink";
import { EditableText } from "@/components/EditableText";

interface SeccionDetalle {
  id: string;
  nombre: string;
  asignatura: { id: string; nombre: string; docente: { id: string; nombre: string; email: string } };
  periodoAcademico: { nombre: string };
  inscripciones: { estudiante: { id: string; nombre: string; email: string } }[];
  evaluaciones: { id: string; nombre: string; estado: "BORRADOR" | "ABIERTO" | "CERRADO" }[];
}

const estadoLabel: Record<string, string> = {
  BORRADOR: "Borrador",
  ABIERTO: "Abierto",
  CERRADO: "Cerrado",
};

const estadoColor: Record<string, string> = {
  BORRADOR: "bg-slate-100 text-slate-600",
  ABIERTO: "bg-emerald-100 text-emerald-700",
  CERRADO: "bg-slate-800 text-white",
};

export default function AdminSeccionDetallePage() {
  const { seccionId } = useParams<{ seccionId: string }>();
  const [seccion, setSeccion] = useState<SeccionDetalle | null>(null);

  useEffect(() => {
    fetch(`/api/admin/secciones/${seccionId}`)
      .then((r) => r.json())
      .then((d) => setSeccion(d.seccion));
  }, [seccionId]);

  if (!seccion) return <p className="text-slate-500">Cargando...</p>;

  async function renombrar(nombre: string) {
    const res = await fetch(`/api/admin/secciones/${seccionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    });
    if (!res.ok) throw new Error("No se pudo renombrar");
    setSeccion((prev) => (prev ? { ...prev, nombre } : prev));
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm text-slate-500">
          <Link href={`/admin/asignaturas/${seccion.asignatura.id}`} className="hover:text-brand-600">
            {seccion.asignatura.nombre}
          </Link>{" "}
          / {seccion.nombre}
        </p>
        <h1 className="text-2xl font-bold">
          <EditableText value={seccion.nombre} onSave={renombrar} />
        </h1>
        <p className="text-slate-500">
          Año-semestre: {seccion.periodoAcademico.nombre} · Docente: {seccion.asignatura.docente.nombre}
        </p>
        <VolverLink href={`/admin/asignaturas/${seccion.asignatura.id}`} texto="Volver a la asignatura" />
      </div>

      <div className="card">
        <h2 className="font-semibold">Evaluaciones ({seccion.evaluaciones.length})</h2>
        {seccion.evaluaciones.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Esta sección aún no tiene evaluaciones.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {seccion.evaluaciones.map((ev) => (
              <li
                key={ev.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium">{ev.nombre}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estadoColor[ev.estado]}`}>
                    {estadoLabel[ev.estado]}
                  </span>
                </div>
                <Link href={`/admin/evaluaciones/${ev.id}`} className="btn-secondary">
                  Ver resultados
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2 className="font-semibold">Estudiantes matriculados ({seccion.inscripciones.length})</h2>
        {seccion.inscripciones.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Esta sección aún no tiene estudiantes.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-1">Nombre</th>
                <th>Correo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {seccion.inscripciones.map(({ estudiante }) => (
                <tr key={estudiante.id} className="border-t border-slate-100">
                  <td className="py-2">{estudiante.nombre}</td>
                  <td className="text-slate-500">{estudiante.email}</td>
                  <td className="text-right">
                    <Link
                      href={`/admin/estudiantes/${estudiante.id}`}
                      className="text-xs text-brand-600 hover:underline"
                    >
                      Ver reporte
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
