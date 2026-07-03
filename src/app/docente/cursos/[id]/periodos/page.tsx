"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { VolverLink } from "@/components/VolverLink";

interface Rubrica {
  id: string;
  nombre: string;
}

interface Periodo {
  id: string;
  nombre: string;
  estado: "BORRADOR" | "ABIERTO" | "CERRADO";
  fechaInicio: string;
  fechaFin: string;
  pesoAutoevaluacion: number;
  pesoCoevaluacion: number;
  pesoDocente: number;
  escalaExigencia: number;
  rubrica: Rubrica;
}

const estadoLabel: Record<Periodo["estado"], string> = {
  BORRADOR: "Borrador",
  ABIERTO: "Abierto",
  CERRADO: "Cerrado",
};

const estadoColor: Record<Periodo["estado"], string> = {
  BORRADOR: "bg-slate-100 text-slate-600",
  ABIERTO: "bg-emerald-100 text-emerald-700",
  CERRADO: "bg-slate-800 text-white",
};

function aFechaInput(iso: string) {
  return iso.slice(0, 10);
}

export default function PeriodosPage() {
  const { id } = useParams<{ id: string }>();
  const [rubricas, setRubricas] = useState<Rubrica[]>([]);
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [nombre, setNombre] = useState("");
  const [rubricaId, setRubricaId] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [pesoAutoevaluacion, setPesoAutoevaluacion] = useState(20);
  const [pesoCoevaluacion, setPesoCoevaluacion] = useState(40);
  const [pesoDocente, setPesoDocente] = useState(40);
  const [escalaExigencia, setEscalaExigencia] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [edicion, setEdicion] = useState({
    nombre: "",
    rubricaId: "",
    fechaInicio: "",
    fechaFin: "",
    pesoAutoevaluacion: 0,
    pesoCoevaluacion: 0,
    pesoDocente: 0,
    escalaExigencia: 60,
  });
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  async function cargarTodo() {
    const [resRub, resPer] = await Promise.all([
      fetch(`/api/cursos/${id}/rubricas`),
      fetch(`/api/cursos/${id}/periodos`),
    ]);
    const dataRub = await resRub.json();
    const dataPer = await resPer.json();
    setRubricas(dataRub.rubricas ?? []);
    setPeriodos(dataPer.periodos ?? []);
    if (!rubricaId && dataRub.rubricas?.[0]) setRubricaId(dataRub.rubricas[0].id);
  }

  useEffect(() => {
    cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const sumaPesos = pesoAutoevaluacion + pesoCoevaluacion + pesoDocente;
  const sumaPesosEdicion = edicion.pesoAutoevaluacion + edicion.pesoCoevaluacion + edicion.pesoDocente;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (Math.abs(sumaPesos - 100) > 0.01) {
      setError(`Los pesos deben sumar 100 (actual: ${sumaPesos}).`);
      return;
    }

    setCargando(true);
    const res = await fetch(`/api/cursos/${id}/periodos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre,
        rubricaId,
        fechaInicio: new Date(fechaInicio).toISOString(),
        fechaFin: new Date(fechaFin).toISOString(),
        pesoAutoevaluacion,
        pesoCoevaluacion,
        pesoDocente,
        escalaExigencia,
      }),
    });
    const data = await res.json();
    setCargando(false);

    if (!res.ok) {
      setError(data.error ?? "No se pudo crear el periodo.");
      return;
    }

    setNombre("");
    setFechaInicio("");
    setFechaFin("");
    cargarTodo();
  }

  async function cambiarEstado(periodoId: string, estado: Periodo["estado"]) {
    await fetch(`/api/periodos/${periodoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    cargarTodo();
  }

  function iniciarEdicion(p: Periodo) {
    setEditandoId(p.id);
    setErrorEdicion(null);
    setEdicion({
      nombre: p.nombre,
      rubricaId: p.rubrica.id,
      fechaInicio: aFechaInput(p.fechaInicio),
      fechaFin: aFechaInput(p.fechaFin),
      pesoAutoevaluacion: p.pesoAutoevaluacion,
      pesoCoevaluacion: p.pesoCoevaluacion,
      pesoDocente: p.pesoDocente,
      escalaExigencia: p.escalaExigencia,
    });
  }

  async function guardarEdicion(p: Periodo) {
    setErrorEdicion(null);
    if (Math.abs(sumaPesosEdicion - 100) > 0.01) {
      setErrorEdicion(`Los pesos deben sumar 100 (actual: ${sumaPesosEdicion}).`);
      return;
    }

    setGuardandoEdicion(true);
    const res = await fetch(`/api/periodos/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: edicion.nombre,
        rubricaId: edicion.rubricaId,
        fechaInicio: new Date(edicion.fechaInicio).toISOString(),
        fechaFin: new Date(edicion.fechaFin).toISOString(),
        pesoAutoevaluacion: edicion.pesoAutoevaluacion,
        pesoCoevaluacion: edicion.pesoCoevaluacion,
        pesoDocente: edicion.pesoDocente,
        escalaExigencia: edicion.escalaExigencia,
      }),
    });
    const data = await res.json();
    setGuardandoEdicion(false);

    if (!res.ok) {
      setErrorEdicion(data.error ?? "No se pudo guardar el periodo.");
      return;
    }

    setEditandoId(null);
    cargarTodo();
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <VolverLink href={`/docente/cursos/${id}`} texto="Volver al curso" />
        <h1 className="mt-2 text-2xl font-bold">Periodos de evaluación</h1>
        <p className="mt-1 text-slate-600">
          Cada periodo usa una rúbrica y define el peso de autoevaluación, coevaluación y evaluación docente (deben
          sumar 100%).
        </p>
      </div>

      <form onSubmit={onSubmit} className="card flex flex-col gap-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="label">Nombre del periodo</label>
            <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="label">Rúbrica</label>
            <select className="input" value={rubricaId} onChange={(e) => setRubricaId(e.target.value)} required>
              <option value="" disabled>
                Selecciona una rúbrica
              </option>
              {rubricas.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="label">Fecha inicio</label>
            <input
              type="date"
              className="input"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Fecha fin</label>
            <input
              type="date"
              className="input"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-40">
            <label className="label">% Autoevaluación</label>
            <input
              type="number"
              className="input"
              value={pesoAutoevaluacion}
              onChange={(e) => setPesoAutoevaluacion(Number(e.target.value))}
            />
          </div>
          <div className="w-40">
            <label className="label">% Coevaluación</label>
            <input
              type="number"
              className="input"
              value={pesoCoevaluacion}
              onChange={(e) => setPesoCoevaluacion(Number(e.target.value))}
            />
          </div>
          <div className="w-40">
            <label className="label">% Docente</label>
            <input
              type="number"
              className="input"
              value={pesoDocente}
              onChange={(e) => setPesoDocente(Number(e.target.value))}
            />
          </div>
          <span className={sumaPesos === 100 ? "text-sm text-emerald-600" : "text-sm text-amber-600"}>
            Suma: {sumaPesos}%
          </span>
        </div>
        <div className="w-56">
          <label className="label">Exigencia para nota 1-7</label>
          <select
            className="input"
            value={escalaExigencia}
            onChange={(e) => setEscalaExigencia(Number(e.target.value))}
          >
            <option value={60}>60% (nota 4.0)</option>
            <option value={70}>70% (nota 4.0)</option>
          </select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary self-start" disabled={cargando}>
          {cargando ? "Creando..." : "Crear periodo"}
        </button>
      </form>

      <div className="flex flex-col gap-4">
        {periodos.map((p) => (
          <div key={p.id} className="card flex flex-col gap-3">
            {editandoId === p.id ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <label className="label">Nombre del periodo</label>
                    <input
                      className="input"
                      value={edicion.nombre}
                      onChange={(e) => setEdicion((prev) => ({ ...prev, nombre: e.target.value }))}
                    />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="label">
                      Rúbrica {p.estado !== "BORRADOR" && <span className="text-xs text-amber-600">(solo editable en Borrador)</span>}
                    </label>
                    <select
                      className="input"
                      value={edicion.rubricaId}
                      onChange={(e) => setEdicion((prev) => ({ ...prev, rubricaId: e.target.value }))}
                      disabled={p.estado !== "BORRADOR"}
                    >
                      {rubricas.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4">
                  <div>
                    <label className="label">Fecha inicio</label>
                    <input
                      type="date"
                      className="input"
                      value={edicion.fechaInicio}
                      onChange={(e) => setEdicion((prev) => ({ ...prev, fechaInicio: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">Fecha fin</label>
                    <input
                      type="date"
                      className="input"
                      value={edicion.fechaFin}
                      onChange={(e) => setEdicion((prev) => ({ ...prev, fechaFin: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-4">
                  <div className="w-40">
                    <label className="label">% Autoevaluación</label>
                    <input
                      type="number"
                      className="input"
                      value={edicion.pesoAutoevaluacion}
                      onChange={(e) =>
                        setEdicion((prev) => ({ ...prev, pesoAutoevaluacion: Number(e.target.value) }))
                      }
                    />
                  </div>
                  <div className="w-40">
                    <label className="label">% Coevaluación</label>
                    <input
                      type="number"
                      className="input"
                      value={edicion.pesoCoevaluacion}
                      onChange={(e) =>
                        setEdicion((prev) => ({ ...prev, pesoCoevaluacion: Number(e.target.value) }))
                      }
                    />
                  </div>
                  <div className="w-40">
                    <label className="label">% Docente</label>
                    <input
                      type="number"
                      className="input"
                      value={edicion.pesoDocente}
                      onChange={(e) => setEdicion((prev) => ({ ...prev, pesoDocente: Number(e.target.value) }))}
                    />
                  </div>
                  <span
                    className={sumaPesosEdicion === 100 ? "text-sm text-emerald-600" : "text-sm text-amber-600"}
                  >
                    Suma: {sumaPesosEdicion}%
                  </span>
                </div>
                <div className="w-56">
                  <label className="label">Exigencia para nota 1-7</label>
                  <select
                    className="input"
                    value={edicion.escalaExigencia}
                    onChange={(e) => setEdicion((prev) => ({ ...prev, escalaExigencia: Number(e.target.value) }))}
                  >
                    <option value={60}>60% (nota 4.0)</option>
                    <option value={70}>70% (nota 4.0)</option>
                  </select>
                </div>
                {errorEdicion && <p className="text-sm text-red-600">{errorEdicion}</p>}
                <div className="flex gap-2">
                  <button className="btn-primary" onClick={() => guardarEdicion(p)} disabled={guardandoEdicion}>
                    {guardandoEdicion ? "Guardando..." : "Guardar"}
                  </button>
                  <button className="btn-secondary" onClick={() => setEditandoId(null)}>
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-semibold">{p.nombre}</h2>
                    <p className="text-sm text-slate-500">
                      Rúbrica: {p.rubrica.nombre} · Auto {p.pesoAutoevaluacion}% / Co {p.pesoCoevaluacion}% / Docente{" "}
                      {p.pesoDocente}%
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${estadoColor[p.estado]}`}>
                    {estadoLabel[p.estado]}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.estado === "BORRADOR" && (
                    <button className="btn-primary" onClick={() => cambiarEstado(p.id, "ABIERTO")}>
                      Abrir periodo
                    </button>
                  )}
                  {p.estado === "ABIERTO" && (
                    <button className="btn-danger" onClick={() => cambiarEstado(p.id, "CERRADO")}>
                      Cerrar y calcular resultados
                    </button>
                  )}
                  {p.estado === "CERRADO" && (
                    <button className="btn-secondary" onClick={() => cambiarEstado(p.id, "ABIERTO")}>
                      Reabrir periodo
                    </button>
                  )}
                  <button className="btn-secondary" onClick={() => iniciarEdicion(p)}>
                    Editar
                  </button>
                  <Link href={`/docente/cursos/${id}/periodos/${p.id}/grupos`} className="btn-secondary">
                    Equipos
                  </Link>
                  <Link href={`/docente/cursos/${id}/periodos/${p.id}/evaluar`} className="btn-secondary">
                    Evaluar estudiantes
                  </Link>
                  <Link href={`/docente/cursos/${id}/periodos/${p.id}/resultados`} className="btn-secondary">
                    Ver resultados
                  </Link>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
