"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { VolverLink } from "@/components/VolverLink";
import { EditableText } from "@/components/EditableText";

interface Seccion {
  id: string;
  nombre: string;
  periodoAcademico: { nombre: string };
  _count: { inscripciones: number; evaluaciones: number };
}

interface Asignatura {
  id: string;
  nombre: string;
  codigo: string;
  docente: { id: string; nombre: string; email: string };
  secciones: Seccion[];
}

export default function AdminAsignaturaDetallePage() {
  const { id } = useParams<{ id: string }>();
  const [asignatura, setAsignatura] = useState<Asignatura | null>(null);

  useEffect(() => {
    fetch(`/api/admin/asignaturas/${id}`)
      .then((r) => r.json())
      .then((d) => setAsignatura(d.asignatura));
  }, [id]);

  if (!asignatura) return <p className="text-slate-500">Cargando...</p>;

  async function actualizar(campo: "nombre" | "codigo", valor: string) {
    const res = await fetch(`/api/admin/asignaturas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [campo]: valor }),
    });
    if (!res.ok) throw new Error("No se pudo guardar");
    setAsignatura((prev) => (prev ? { ...prev, [campo]: valor } : prev));
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <VolverLink href="/admin/asignaturas" texto="Volver a asignaturas" />
        <h1 className="mt-2 text-2xl font-bold">
          <EditableText value={asignatura.nombre} onSave={(v) => actualizar("nombre", v)} />
        </h1>
        <p className="text-slate-500">
          Código: <EditableText value={asignatura.codigo} onSave={(v) => actualizar("codigo", v)} />
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Docente:{" "}
          <Link href={`/admin/docentes/${asignatura.docente.id}`} className="font-medium text-brand-600 hover:underline">
            {asignatura.docente.nombre}
          </Link>{" "}
          <span className="text-slate-400">({asignatura.docente.email})</span>
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="font-semibold">
          Secciones ({asignatura.secciones.length}) — vista de solo lectura, igual a lo que ve el docente
        </h2>
        {asignatura.secciones.length === 0 ? (
          <p className="text-slate-500">Esta asignatura aún no tiene secciones.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {asignatura.secciones.map((s) => (
              <Link key={s.id} href={`/admin/secciones/${s.id}`} className="card hover:border-brand-500">
                <h3 className="font-semibold">{s.nombre}</h3>
                <p className="text-sm text-slate-500">{s.periodoAcademico.nombre}</p>
                <div className="mt-3 flex gap-4 text-xs text-slate-500">
                  <span>{s._count.inscripciones} estudiantes</span>
                  <span>{s._count.evaluaciones} evaluaciones</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
