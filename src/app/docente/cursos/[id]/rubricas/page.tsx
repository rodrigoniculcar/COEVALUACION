"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { VolverLink } from "@/components/VolverLink";

interface Criterio {
  id?: string;
  nombre: string;
  descripcion?: string;
  ponderacion: number;
}

interface Rubrica {
  id: string;
  nombre: string;
  escalaMin: number;
  escalaMax: number;
  criterios: Criterio[];
}

const criterioVacio = (): Criterio => ({ nombre: "", descripcion: "", ponderacion: 0 });

export default function RubricasPage() {
  const { id } = useParams<{ id: string }>();
  const [rubricas, setRubricas] = useState<Rubrica[]>([]);
  const [nombre, setNombre] = useState("");
  const [escalaMin, setEscalaMin] = useState(1);
  const [escalaMax, setEscalaMax] = useState(5);
  const [criterios, setCriterios] = useState<Criterio[]>([criterioVacio(), criterioVacio()]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function cargarRubricas() {
    const res = await fetch(`/api/cursos/${id}/rubricas`);
    const data = await res.json();
    setRubricas(data.rubricas ?? []);
  }

  useEffect(() => {
    cargarRubricas();
  }, [id]);

  const sumaPonderaciones = criterios.reduce((acc, c) => acc + (Number(c.ponderacion) || 0), 0);

  function actualizarCriterio(idx: number, campo: keyof Criterio, valor: string) {
    setCriterios((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [campo]: campo === "ponderacion" ? Number(valor) : valor } : c))
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (Math.abs(sumaPonderaciones - 100) > 0.01) {
      setError(`La suma de ponderaciones debe ser 100 (actual: ${sumaPonderaciones}).`);
      return;
    }

    setCargando(true);
    const res = await fetch(`/api/cursos/${id}/rubricas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, escalaMin, escalaMax, criterios }),
    });
    const data = await res.json();
    setCargando(false);

    if (!res.ok) {
      setError(data.error ?? "No se pudo crear la rúbrica.");
      return;
    }

    setNombre("");
    setCriterios([criterioVacio(), criterioVacio()]);
    cargarRubricas();
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <VolverLink href={`/docente/cursos/${id}`} texto="Volver al curso" />
        <h1 className="mt-2 text-2xl font-bold">Rúbricas</h1>
        <p className="mt-1 text-slate-600">
          Define los criterios y su ponderación (deben sumar 100%) y la escala de puntaje a usar.
        </p>
      </div>

      <form onSubmit={onSubmit} className="card flex flex-col gap-4">
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
            <div key={idx} className="flex flex-wrap items-start gap-2 rounded-lg border border-slate-200 p-3">
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
        <button className="btn-primary self-start" disabled={cargando}>
          {cargando ? "Guardando..." : "Guardar rúbrica"}
        </button>
      </form>

      <div className="flex flex-col gap-4">
        {rubricas.map((r) => (
          <div key={r.id} className="card">
            <h2 className="font-semibold">
              {r.nombre} <span className="text-sm font-normal text-slate-500">(escala {r.escalaMin}-{r.escalaMax})</span>
            </h2>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1">Criterio</th>
                  <th className="w-24">Peso</th>
                </tr>
              </thead>
              <tbody>
                {r.criterios.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="py-1">{c.nombre}</td>
                    <td>{c.ponderacion}%</td>
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
