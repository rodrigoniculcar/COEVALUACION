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
  secciones: Seccion[];
}

interface Docente {
  id: string;
  rut: string | null;
  nombre: string;
  email: string;
  activo: boolean;
  ultimoLogin: string | null;
  createdAt: string;
}

function formatearFecha(iso: string | null) {
  if (!iso) return "Nunca";
  return new Date(iso).toLocaleString("es-CL", { dateStyle: "long", timeStyle: "short" });
}

export default function AdminDocentePerfilPage() {
  const { id } = useParams<{ id: string }>();
  const [docente, setDocente] = useState<Docente | null>(null);
  const [asignaturas, setAsignaturas] = useState<Asignatura[]>([]);

  useEffect(() => {
    fetch(`/api/admin/docentes/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setDocente(d.docente);
        setAsignaturas(d.asignaturas ?? []);
      });
  }, [id]);

  if (!docente) return <p className="text-slate-500">Cargando...</p>;

  const totalSecciones = asignaturas.reduce((acc, a) => acc + a.secciones.length, 0);
  const totalEstudiantes = asignaturas.reduce(
    (acc, a) => acc + a.secciones.reduce((n, s) => n + s._count.inscripciones, 0),
    0
  );

  async function renombrar(nombre: string) {
    const res = await fetch(`/api/admin/usuarios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    });
    if (!res.ok) throw new Error("No se pudo renombrar");
    setDocente((prev) => (prev ? { ...prev, nombre } : prev));
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <VolverLink href="/admin/docentes" texto="Volver a docentes" />
        <h1 className="mt-2 text-2xl font-bold">
          <EditableText value={docente.nombre} onSave={renombrar} />
        </h1>
        <p className="text-slate-500">
          {docente.email} {docente.rut && `· RUT ${docente.rut}`}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Último ingreso: {formatearFecha(docente.ultimoLogin)} · Cuenta creada:{" "}
          {new Date(docente.createdAt).toLocaleDateString("es-CL")}
        </p>
        <span
          className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
            docente.activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
          }`}
        >
          {docente.activo ? "Activo" : "Desactivado"}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-sm text-slate-500">Asignaturas</p>
          <p className="text-3xl font-bold">{asignaturas.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Secciones</p>
          <p className="text-3xl font-bold">{totalSecciones}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Estudiantes (todas las secciones)</p>
          <p className="text-3xl font-bold">{totalEstudiantes}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="font-semibold">
          Asignaturas ({asignaturas.length}) — vista de solo lectura, igual a lo que ve este docente
        </h2>
        {asignaturas.length === 0 ? (
          <p className="text-slate-500">Este docente aún no tiene asignaturas.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {asignaturas.map((a) => (
              <Link key={a.id} href={`/admin/asignaturas/${a.id}`} className="card hover:border-brand-500">
                <h3 className="font-semibold">{a.nombre}</h3>
                <p className="text-sm text-slate-500">Código: {a.codigo}</p>
                {a.secciones.length === 0 ? (
                  <p className="mt-3 text-xs text-slate-400">Sin secciones</p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-0.5 text-xs text-slate-500">
                    {a.secciones.map((s) => (
                      <li key={s.id}>
                        {s.nombre} ({s.periodoAcademico.nombre}) · {s._count.inscripciones} estudiantes ·{" "}
                        {s._count.evaluaciones} evaluaciones
                      </li>
                    ))}
                  </ul>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
