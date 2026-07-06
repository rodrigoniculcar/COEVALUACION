"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { VolverLink } from "@/components/VolverLink";

interface SeccionDetalle {
  id: string;
  nombre: string;
  asignatura: { id: string; nombre: string };
  periodoAcademico: { nombre: string };
  inscripciones: { estudiante: { id: string; nombre: string; email: string } }[];
  evaluaciones: { id: string; nombre: string; estado: string }[];
}

export default function SeccionHubPage() {
  const { id, seccionId } = useParams<{ id: string; seccionId: string }>();
  const [seccion, setSeccion] = useState<SeccionDetalle | null>(null);

  useEffect(() => {
    fetch(`/api/secciones/${seccionId}`)
      .then((r) => r.json())
      .then((d) => setSeccion(d.seccion));
  }, [seccionId]);

  if (!seccion) return <p className="text-slate-500">Cargando...</p>;

  const secciones = [
    {
      href: `/docente/asignaturas/${id}/secciones/${seccionId}/estudiantes`,
      titulo: "Estudiantes",
      valor: `${seccion.inscripciones.length} matriculados`,
      descripcion: "Carga alumnos a esta sección (crea sus credenciales de acceso). El roster es fijo.",
    },
    {
      href: `/docente/asignaturas/${id}/secciones/${seccionId}/evaluaciones`,
      titulo: "Evaluaciones",
      valor: `${seccion.evaluaciones.length} evaluaciones`,
      descripcion: "Cada evaluación tiene su propia rúbrica, fechas, equipos y coevaluadores docentes.",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm text-slate-500">
          <Link href="/docente" className="hover:text-brand-600">
            Mis asignaturas
          </Link>{" "}
          /{" "}
          <Link href={`/docente/asignaturas/${id}`} className="hover:text-brand-600">
            {seccion.asignatura.nombre}
          </Link>{" "}
          / {seccion.nombre}
        </p>
        <h1 className="text-2xl font-bold">{seccion.nombre}</h1>
        <p className="text-slate-500">Año-semestre: {seccion.periodoAcademico.nombre}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {secciones.map((s) => (
          <Link key={s.href} href={s.href} className="card hover:border-brand-500">
            <h2 className="font-semibold">{s.titulo}</h2>
            <p className="mt-1 text-sm text-slate-500">{s.descripcion}</p>
            <p className="mt-3 text-sm font-medium text-brand-600">{s.valor}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
