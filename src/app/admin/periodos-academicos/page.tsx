"use client";

import { FormEvent, useEffect, useState } from "react";

interface PeriodoAcademico {
  id: string;
  nombre: string;
  createdAt: string;
}

const ANIO_ACTUAL = new Date().getFullYear();
const ANIOS_DISPONIBLES = Array.from({ length: 6 }, (_, i) => ANIO_ACTUAL - 1 + i);

export default function AdminPeriodosAcademicosPage() {
  const [periodos, setPeriodos] = useState<PeriodoAcademico[]>([]);
  const [anio, setAnio] = useState(ANIO_ACTUAL);
  const [semestre, setSemestre] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function cargar() {
    const res = await fetch("/api/periodos-academicos");
    const data = await res.json();
    setPeriodos(data.periodosAcademicos ?? []);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function crear(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMensaje(null);
    setCargando(true);

    const res = await fetch("/api/periodos-academicos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: `${anio}-${semestre}` }),
    });
    const data = await res.json();
    setCargando(false);

    if (!res.ok) {
      setError(data.error ?? "No se pudo crear el año-semestre.");
      return;
    }

    setMensaje(`Año-semestre "${data.periodoAcademico.nombre}" disponible.`);
    cargar();
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Años-semestre</h1>
        <p className="mt-1 text-slate-600">
          Catálogo compartido por toda la plataforma: los docentes eligen uno de estos al crear una sección.
          Crear aquí uno nuevo evita variantes de escritura entre distintos docentes.
        </p>
      </div>

      <form onSubmit={crear} className="card flex flex-wrap items-end gap-4">
        <div className="w-32">
          <label className="label">Año</label>
          <select className="input" value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
            {ANIOS_DISPONIBLES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="w-32">
          <label className="label">Semestre</label>
          <select className="input" value={semestre} onChange={(e) => setSemestre(Number(e.target.value))}>
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </div>
        <button className="btn-primary" disabled={cargando}>
          {cargando ? "Creando..." : "Crear año-semestre"}
        </button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
        {mensaje && <p className="w-full text-sm text-emerald-600">{mensaje}</p>}
      </form>

      <div className="card">
        <h2 className="font-semibold">Años-semestre existentes ({periodos.length})</h2>
        <ul className="mt-3 flex flex-col gap-1">
          {periodos.map((p) => (
            <li key={p.id} className="border-t border-slate-100 py-2 text-sm">
              {p.nombre}
            </li>
          ))}
        </ul>
        {periodos.length === 0 && <p className="mt-2 text-sm text-slate-500">Aún no hay ninguno creado.</p>}
      </div>
    </div>
  );
}
