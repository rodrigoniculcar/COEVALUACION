"use client";

import { FormEvent, useEffect, useState } from "react";

interface Criterio {
  id?: string;
  nombre: string;
  descripcion?: string;
  ponderacion: number;
  aplicaAutoevaluacion: boolean;
  aplicaCoevaluacion: boolean;
  aplicaDocente: boolean;
}

interface Rubrica {
  id: string;
  nombre: string;
  escalaMin: number;
  escalaMax: number;
  criterios: Criterio[];
  creador: { id: string; nombre: string };
}

const criterioVacio = (): Criterio => ({
  nombre: "",
  descripcion: "",
  ponderacion: 0,
  aplicaAutoevaluacion: true,
  aplicaCoevaluacion: true,
  aplicaDocente: true,
});

export default function RubricasPage() {
  const [rubricas, setRubricas] = useState<Rubrica[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [escalaMin, setEscalaMin] = useState(1);
  const [escalaMax, setEscalaMax] = useState(5);
  const [criterios, setCriterios] = useState<Criterio[]>([criterioVacio(), criterioVacio()]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  async function cargarRubricas() {
    const res = await fetch("/api/rubricas");
    const data = await res.json();
    setRubricas(data.rubricas ?? []);
  }

  useEffect(() => {
    cargarRubricas();
  }, []);

  const sumaPonderaciones = criterios.reduce((acc, c) => acc + (Number(c.ponderacion) || 0), 0);

  function actualizarCriterio(idx: number, campo: keyof Criterio, valor: string) {
    setCriterios((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [campo]: campo === "ponderacion" ? Number(valor) : valor } : c))
    );
  }

  function alternarVisibilidad(
    idx: number,
    campo: "aplicaAutoevaluacion" | "aplicaCoevaluacion" | "aplicaDocente"
  ) {
    setCriterios((prev) => prev.map((c, i) => (i === idx ? { ...c, [campo]: !c[campo] } : c)));
  }

  function iniciarEdicion(r: Rubrica) {
    setEditandoId(r.id);
    setNombre(r.nombre);
    setEscalaMin(r.escalaMin);
    setEscalaMax(r.escalaMax);
    setCriterios(r.criterios.map((c) => ({ ...c })));
    setError(null);
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setNombre("");
    setEscalaMin(1);
    setEscalaMax(5);
    setCriterios([criterioVacio(), criterioVacio()]);
    setError(null);
  }

  async function eliminarRubrica(id: string, nombreRubrica: string) {
    if (!confirm(`¿Eliminar la rúbrica "${nombreRubrica}"? Esta acción no se puede deshacer.`)) return;
    setErrorEliminar(null);
    setEliminandoId(id);
    const res = await fetch(`/api/rubricas/${id}`, { method: "DELETE" });
    setEliminandoId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErrorEliminar(data.error ?? "No se pudo eliminar la rúbrica.");
      return;
    }
    if (editandoId === id) cancelarEdicion();
    cargarRubricas();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (Math.abs(sumaPonderaciones - 100) > 0.01) {
      setError(`La suma de ponderaciones debe ser 100 (actual: ${sumaPonderaciones}).`);
      return;
    }

    setCargando(true);
    const res = await fetch(editandoId ? `/api/rubricas/${editandoId}` : "/api/rubricas", {
      method: editandoId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, escalaMin, escalaMax, criterios }),
    });
    const data = await res.json();
    setCargando(false);

    if (!res.ok) {
      setError(data.error ?? "No se pudo guardar la rúbrica.");
      return;
    }

    cancelarEdicion();
    cargarRubricas();
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Rúbricas</h1>
        <p className="mt-1 text-slate-600">
          Biblioteca compartida entre docentes: cualquier docente puede reutilizar o modificar una rúbrica ya
          creada, y asignarla a una o más evaluaciones. Define los criterios y su ponderación (deben sumar
          100%) y la escala de puntaje a usar (puede partir en 0).
        </p>
      </div>

      <form onSubmit={onSubmit} className="card flex flex-col gap-4">
        {editandoId && (
          <p className="text-sm text-amber-700">
            Editando una rúbrica existente. Si ya está en uso en una evaluación abierta o cerrada, no podrás
            cambiar sus criterios ni su escala (solo nombre/descripción).
          </p>
        )}
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="label">Nombre de la rúbrica</label>
            <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </div>
          <div className="w-28">
            <label className="label">Escala mín.</label>
            <input
              type="number"
              className="input"
              value={escalaMin}
              onChange={(e) => setEscalaMin(Number(e.target.value))}
            />
          </div>
          <div className="w-28">
            <label className="label">Escala máx.</label>
            <input
              type="number"
              className="input"
              value={escalaMax}
              onChange={(e) => setEscalaMax(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="label mb-0">Criterios</label>
            <span className={sumaPonderaciones === 100 ? "text-sm text-emerald-600" : "text-sm text-amber-600"}>
              Suma actual: {sumaPonderaciones}%
            </span>
          </div>
          {criterios.map((c, idx) => (
            <div key={idx} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-start gap-2">
                <input
                  className="input flex-1 min-w-[160px]"
                  placeholder="Nombre del criterio"
                  value={c.nombre}
                  onChange={(e) => actualizarCriterio(idx, "nombre", e.target.value)}
                  required
                />
                <input
                  className="input flex-[2] min-w-[200px]"
                  placeholder="Descripción (opcional)"
                  value={c.descripcion}
                  onChange={(e) => actualizarCriterio(idx, "descripcion", e.target.value)}
                />
                <input
                  type="number"
                  className="input w-28"
                  placeholder="% Peso"
                  value={c.ponderacion || ""}
                  onChange={(e) => actualizarCriterio(idx, "ponderacion", e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setCriterios((prev) => prev.filter((_, i) => i !== idx))}
                  disabled={criterios.length <= 1}
                >
                  Quitar
                </button>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                <span className="text-slate-500">Visible para:</span>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={c.aplicaAutoevaluacion}
                    onChange={() => alternarVisibilidad(idx, "aplicaAutoevaluacion")}
                  />
                  Autoevaluación
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={c.aplicaCoevaluacion}
                    onChange={() => alternarVisibilidad(idx, "aplicaCoevaluacion")}
                  />
                  Coevaluación
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={c.aplicaDocente}
                    onChange={() => alternarVisibilidad(idx, "aplicaDocente")}
                  />
                  Docente
                </label>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="btn-secondary self-start"
            onClick={() => setCriterios((prev) => [...prev, criterioVacio()])}
          >
            + Agregar criterio
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button className="btn-primary self-start" disabled={cargando}>
            {cargando ? "Guardando..." : editandoId ? "Guardar cambios" : "Crear rúbrica"}
          </button>
          {editandoId && (
            <button type="button" className="btn-secondary self-start" onClick={cancelarEdicion}>
              Cancelar edición
            </button>
          )}
        </div>
      </form>

      {errorEliminar && <p className="text-sm text-red-600">{errorEliminar}</p>}

      <div className="flex flex-col gap-4">
        {rubricas.map((r) => (
          <div key={r.id} className="card">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">
                {r.nombre}{" "}
                <span className="text-sm font-normal text-slate-500">
                  (escala {r.escalaMin}-{r.escalaMax}) · creada por {r.creador.nombre}
                </span>
              </h2>
              <div className="flex shrink-0 gap-3">
                <button className="text-xs text-brand-600 hover:underline" onClick={() => iniciarEdicion(r)}>
                  Editar
                </button>
                <button
                  className="text-xs text-red-600 hover:underline disabled:opacity-50"
                  onClick={() => eliminarRubrica(r.id, r.nombre)}
                  disabled={eliminandoId === r.id}
                >
                  {eliminandoId === r.id ? "Eliminando..." : "Eliminar"}
                </button>
              </div>
            </div>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1">Criterio</th>
                  <th className="w-24">Peso</th>
                  <th className="w-56">Visible para</th>
                </tr>
              </thead>
              <tbody>
                {r.criterios.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="py-1">{c.nombre}</td>
                    <td>{c.ponderacion}%</td>
                    <td className="flex flex-wrap gap-1 py-1">
                      {c.aplicaAutoevaluacion && (
                        <span className="rounded bg-sky-100 px-1.5 py-0.5 text-xs text-sky-700">Auto</span>
                      )}
                      {c.aplicaCoevaluacion && (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-700">Co</span>
                      )}
                      {c.aplicaDocente && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">Docente</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
