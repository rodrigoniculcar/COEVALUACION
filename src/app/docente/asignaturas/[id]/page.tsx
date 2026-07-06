"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { VolverLink } from "@/components/VolverLink";

interface PeriodoAcademico {
  id: string;
  nombre: string;
}

interface Seccion {
  id: string;
  nombre: string;
  periodoAcademico: PeriodoAcademico;
  _count: { inscripciones: number; evaluaciones: number };
}

interface Asignatura {
  id: string;
  nombre: string;
  codigo: string;
  secciones: Seccion[];
}

const NUEVO_PERIODO = "__nuevo__";

export default function AsignaturaHubPage() {
  const { id } = useParams<{ id: string }>();
  const [asignatura, setAsignatura] = useState<Asignatura | null>(null);
  const [periodosAcademicos, setPeriodosAcademicos] = useState<PeriodoAcademico[]>([]);
  const [nombre, setNombre] = useState("");
  const [periodoAcademicoId, setPeriodoAcademicoId] = useState("");
  const [nuevoPeriodoNombre, setNuevoPeriodoNombre] = useState("");
  const [filtroPeriodo, setFiltroPeriodo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function cargarTodo() {
    const [resAsig, resPA] = await Promise.all([
      fetch(`/api/asignaturas/${id}`),
      fetch("/api/periodos-academicos"),
    ]);
    const dataAsig = await resAsig.json();
    const dataPA = await resPA.json();
    setAsignatura(dataAsig.asignatura);
    setPeriodosAcademicos(dataPA.periodosAcademicos ?? []);
    if (!periodoAcademicoId && dataPA.periodosAcademicos?.[0]) {
      setPeriodoAcademicoId(dataPA.periodosAcademicos[0].id);
    }
  }

  useEffect(() => {
    cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const seccionesFiltradas = useMemo(() => {
    if (!asignatura) return [];
    if (!filtroPeriodo.trim()) return asignatura.secciones;
    const q = filtroPeriodo.trim().toLowerCase();
    return asignatura.secciones.filter(
      (s) => s.periodoAcademico.nombre.toLowerCase().includes(q) || s.nombre.toLowerCase().includes(q)
    );
  }, [asignatura, filtroPeriodo]);

  async function crearSeccion(e: FormEvent) {
    e.preventDefault();
    setError(null);

    let periodoId = periodoAcademicoId;
    setCargando(true);

    if (periodoId === NUEVO_PERIODO) {
      if (!nuevoPeriodoNombre.trim()) {
        setError("Ingresa el nombre del nuevo año-semestre (ej. 2026-1).");
        setCargando(false);
        return;
      }
      const resPA = await fetch("/api/periodos-academicos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nuevoPeriodoNombre.trim() }),
      });
      const dataPA = await resPA.json();
      if (!resPA.ok) {
        setError(dataPA.error ?? "No se pudo crear el año-semestre.");
        setCargando(false);
        return;
      }
      periodoId = dataPA.periodoAcademico.id;
    }

    const res = await fetch(`/api/asignaturas/${id}/secciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, periodoAcademicoId: periodoId }),
    });
    const data = await res.json();
    setCargando(false);

    if (!res.ok) {
      setError(data.error ?? "No se pudo crear la sección.");
      return;
    }

    setNombre("");
    setNuevoPeriodoNombre("");
    cargarTodo();
  }

  if (!asignatura) return <p className="text-slate-500">Cargando...</p>;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <VolverLink href="/docente" texto="Mis asignaturas" />
        <h1 className="mt-2 text-2xl font-bold">{asignatura.nombre}</h1>
        <p className="text-slate-500">Código: {asignatura.codigo}</p>
      </div>

      <form onSubmit={crearSeccion} className="card flex flex-col gap-4">
        <h2 className="font-semibold">Nueva sección</h2>
        <p className="text-sm text-slate-600">
          Una sección es la oferta concreta de esta asignatura en un año-semestre, con su propio roster de
          estudiantes. Puedes tener varias secciones a cargo por semestre (ej. Sección A, Sección B).
        </p>
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[160px]">
            <label className="label">Nombre de la sección</label>
            <input
              className="input"
              placeholder="Sección A"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="label">Año-semestre</label>
            <select
              className="input"
              value={periodoAcademicoId}
              onChange={(e) => setPeriodoAcademicoId(e.target.value)}
            >
              {periodosAcademicos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
              <option value={NUEVO_PERIODO}>+ Crear nuevo año-semestre</option>
            </select>
          </div>
          {periodoAcademicoId === NUEVO_PERIODO && (
            <div className="flex-1 min-w-[160px]">
              <label className="label">Nombre del nuevo año-semestre</label>
              <input
                className="input"
                placeholder="2026-2"
                value={nuevoPeriodoNombre}
                onChange={(e) => setNuevoPeriodoNombre(e.target.value)}
              />
            </div>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary self-start" disabled={cargando}>
          {cargando ? "Creando..." : "Crear sección"}
        </button>
      </form>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Secciones ({asignatura.secciones.length})</h2>
          <input
            className="input max-w-xs"
            placeholder="Buscar por año-semestre o nombre..."
            value={filtroPeriodo}
            onChange={(e) => setFiltroPeriodo(e.target.value)}
          />
        </div>

        {seccionesFiltradas.length === 0 ? (
          <p className="text-slate-500">No hay secciones que coincidan con la búsqueda.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {seccionesFiltradas.map((s) => (
              <Link
                key={s.id}
                href={`/docente/asignaturas/${id}/secciones/${s.id}`}
                className="card hover:border-brand-500"
              >
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
