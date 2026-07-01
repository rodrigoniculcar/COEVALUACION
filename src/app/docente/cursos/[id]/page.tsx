"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface CursoDetalle {
  id: string;
  nombre: string;
  codigo: string;
  inscripciones: { estudiante: { id: string; nombre: string; email: string } }[];
  grupos: { id: string; nombre: string; miembros: { estudiante: { nombre: string } }[] }[];
  rubricas: { id: string; nombre: string }[];
  periodos: { id: string; nombre: string; estado: string }[];
}

export default function CursoHubPage() {
  const { id } = useParams<{ id: string }>();
  const [curso, setCurso] = useState<CursoDetalle | null>(null);

  useEffect(() => {
    fetch(`/api/cursos/${id}`)
      .then((r) => r.json())
      .then((d) => setCurso(d.curso));
  }, [id]);

  if (!curso) return <p className="text-slate-500">Cargando...</p>;

  const secciones = [
    {
      href: `/docente/cursos/${id}/estudiantes`,
      titulo: "Estudiantes",
      valor: `${curso.inscripciones.length} cargados`,
      descripcion: "Carga alumnos al curso (crea sus credenciales de acceso).",
    },
    {
      href: `/docente/cursos/${id}/grupos`,
      titulo: "Equipos",
      valor: `${curso.grupos.length} equipos`,
      descripcion: "Define los equipos de trabajo para la coevaluación.",
    },
    {
      href: `/docente/cursos/${id}/rubricas`,
      titulo: "Rúbricas",
      valor: `${curso.rubricas.length} rúbricas`,
      descripcion: "Configura criterios y ponderaciones de evaluación.",
    },
    {
      href: `/docente/cursos/${id}/periodos`,
      titulo: "Periodos de evaluación",
      valor: `${curso.periodos.length} periodos`,
      descripcion: "Define pesos de auto/co/docente y abre o cierra la evaluación.",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm text-slate-500">
          <Link href="/docente" className="hover:text-brand-600">
            Mis cursos
          </Link>{" "}
          / {curso.nombre}
        </p>
        <h1 className="text-2xl font-bold">{curso.nombre}</h1>
        <p className="text-slate-500">Código: {curso.codigo}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
