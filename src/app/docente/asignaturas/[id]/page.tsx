"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { VolverLink } from "@/components/VolverLink";

interface PeriodoAcademico {
  id: string;
  nombre: string;
  actual?: boolean;
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
const ANIO_ACTUAL = new Date().getFullYear();
const ANIOS_DISPONIBLES = Array.from({ length: 6 }, (_, i) => ANIO_ACTUAL - 1 + i);

export default function AsignaturaHubPage() {
  const { id } = useParams<{ id: string }>();
  const [asignatura, setAsignatura] = useState<Asignatura | null>(null);
  const [periodosAcademicos, setPeriodosAcademicos] = useState<PeriodoAcademico[]>([]);
  const [nombre, setNombre] = useState("");
  const [periodoAcademicoId, setPeriodoAcademicoId] = useState("");
  const [nuevoAnio, setNuevoAnio] = useState(ANIO_ACTUAL);
  const [nuevoSemestre, setNuevoSemestre] = useState(1);
  const [filtroPeriodo, setFiltroPeriodo] = useState("");
  const [mostrarAnteriores, setMostrarAnteriores] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

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

  const hayPeriodoActual = useMemo(
    () => (asignatura?.secciones ?? []).some((s) => s.periodoAcademico.actual),
    [asignatura]
  );

  const seccionesFiltradas = useMemo(() => {
    if (!asignatura) return [];
    let secciones = asignatura.secciones;
    if (hayPeriodoActual && !mostrarAnteriores) {
      secciones = secciones.filter((s) => s.periodoAcademico.actual);
    }
    if (!filtroPeriodo.trim()) return secciones;
    const q = filtroPeriodo.trim().toLowerCase();
    return secciones.filter(
      (s) => s.periodoAcademico.nombre.toLowerCase().includes(q) || s.nombre.toLowerCase().includes(q)
    );
  }, [asignatura, filtroPeriodo, hayPeriodoActual, mostrarAnteriores]);

  async function crearSeccion(e: FormEvent) {
    e.preventDefault();
    setError(null);

    let periodoId = periodoAcademicoId;
    setCargando(true);

    if (periodoId === NUEVO_PERIODO) {
      const resPA = await fetch("/api/periodos-academicos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: `${nuevoAnio}-${nuevoSemestre}` }),
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
    cargarTodo();
  }

  async function eliminarSeccion(seccionId: string, seccionNombre: string) {
    if (
      !confirm(
        `¿Eliminar la sección "${seccionNombre}"? Esto borra también su roster de estudiantes, evaluaciones, equipos y resultados. Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    setEliminandoId(seccionId);
    await fetch(`/api/secciones/${seccionId}`, { method: "DELETE" });
    setEliminandoId(null);
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
            <>
              <div className="w-32">
                <label className="label">Año</label>
                <select
                  className="input"
                  value={nuevoAnio}
                  onChange={(e) => setNuevoAnio(Number(e.target.value))}
                >
                  {ANIOS_DISPONIBLES.map((anio) => (
                    <option key={anio} value={anio}>
                      {anio}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-32">
                <label className="label">Semestre</label>
                <select
                  className="input"
                  value={nuevoSemestre}
                  onChange={(e) => setNuevoSemestre(Number(e.target.value))}
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                </select>
              </div>
            </>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary self-start" disabled={cargando}>
          {cargando ? "Creando..." : "Crear sección"}
        </button>
      </form>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Secciones ({asignatura.secciones.length})</h2>
          <div className="flex flex-wrap items-center gap-4">
            {hayPeriodoActual && (
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={mostrarAnteriores}
                  onChange={(e) => setMostrarAnteriores(e.target.checked)}
                />
                Ver años-semestre anteriores
              </label>
            )}
            <input
              className="input max-w-xs"
              placeholder="Buscar por año-semestre o nombre..."
              value={filtroPeriodo}
              onChange={(e) => setFiltroPeriodo(e.target.value)}
            />
          </div>
        </div>

        {seccionesFiltradas.length === 0 && asignatura.secciones.length > 0 && !mostrarAnteriores && hayPeriodoActual ? (
          <p className="text-slate-500">
            No hay secciones en el año-semestre actual. Activa &quot;Ver años-semestre anteriores&quot; para
            revisar las de otros periodos.
          </p>
        ) : seccionesFiltradas.length === 0 ? (
          <p className="text-slate-500">No hay secciones que coincidan con la búsqueda.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {seccionesFiltradas.map((s) => (
              <div key={s.id} className="card hover:border-brand-500">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/docente/asignaturas/${id}/secciones/${s.id}`} className="flex-1">
                    <h3 className="font-semibold">{s.nombre}</h3>
                    <p className="text-sm text-slate-500">{s.periodoAcademico.nombre}</p>
                    <div className="mt-3 flex gap-4 text-xs text-slate-500">
                      <span>{s._count.inscripciones} estudiantes</span>
                      <span>{s._count.evaluaciones} evaluaciones</span>
                    </div>
                  </Link>
                  <button
                    className="text-xs text-red-600 hover:underline disabled:opacity-50"
                    onClick={() => eliminarSeccion(s.id, s.nombre)}
                    disabled={eliminandoId === s.id}
                  >
                    {eliminandoId === s.id ? "Eliminando..." : "Eliminar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
