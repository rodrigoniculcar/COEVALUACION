"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Inscripcion {
  estudiante: { id: string; nombre: string; email: string };
}

interface ResultadoCarga {
  email: string;
  estado: string;
  nombre?: string;
  passwordTemporal?: string | null;
  motivo?: string;
}

export default function EstudiantesPage() {
  const { id } = useParams<{ id: string }>();
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [textoCarga, setTextoCarga] = useState("");
  const [resultado, setResultado] = useState<ResultadoCarga[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function cargarInscripciones() {
    const res = await fetch(`/api/cursos/${id}/estudiantes`);
    const data = await res.json();
    setInscripciones(data.inscripciones ?? []);
  }

  useEffect(() => {
    cargarInscripciones();
  }, [id]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResultado(null);

    const filas = textoCarga
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((linea) => {
        const [nombre, email] = linea.split(",").map((v) => v.trim());
        return { nombre, email };
      });

    if (filas.some((f) => !f.nombre || !f.email)) {
      setError('Cada línea debe tener el formato "Nombre completo, correo@ejemplo.com"');
      return;
    }

    setCargando(true);
    const res = await fetch(`/api/cursos/${id}/estudiantes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estudiantes: filas }),
    });
    const data = await res.json();
    setCargando(false);

    if (!res.ok) {
      setError(data.error ?? "No se pudo procesar la carga.");
      return;
    }

    setResultado(data.resultado);
    setTextoCarga("");
    cargarInscripciones();
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Carga de estudiantes</h1>
        <p className="mt-1 text-slate-600">
          Ingresa un estudiante por línea con el formato <code>Nombre completo, correo@ejemplo.com</code>. Si el
          correo no existe se crea una cuenta con contraseña temporal.
        </p>
      </div>

      <form onSubmit={onSubmit} className="card flex flex-col gap-4">
        <textarea
          className="input h-40 font-mono text-sm"
          placeholder={"Ana Torres, ana.torres@correo.com\nLuis Pérez, luis.perez@correo.com"}
          value={textoCarga}
          onChange={(e) => setTextoCarga(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary self-start" disabled={cargando}>
          {cargando ? "Procesando..." : "Cargar estudiantes"}
        </button>
      </form>

      {resultado && (
        <div className="card">
          <h2 className="font-semibold">Resultado de la carga</h2>
          <p className="mt-1 text-sm text-amber-700">
            Copia y comparte las contraseñas temporales ahora: no se podrán volver a mostrar.
          </p>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-1">Correo</th>
                <th>Estado</th>
                <th>Contraseña temporal</th>
              </tr>
            </thead>
            <tbody>
              {resultado.map((r) => (
                <tr key={r.email} className="border-t border-slate-100">
                  <td className="py-1">{r.email}</td>
                  <td>{r.estado === "matriculado" ? "Matriculado" : `Omitido (${r.motivo})`}</td>
                  <td className="font-mono">{r.passwordTemporal ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <h2 className="font-semibold">Estudiantes matriculados ({inscripciones.length})</h2>
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {inscripciones.map((i) => (
            <li key={i.estudiante.id} className="flex justify-between py-2">
              <span>{i.estudiante.nombre}</span>
              <span className="text-slate-500">{i.estudiante.email}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
