"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Periodo {
  id: string;
  nombre: string;
  estado: "BORRADOR" | "ABIERTO" | "CERRADO";
  fechaFin: string;
}

interface Inscripcion {
  curso: {
    id: string;
    nombre: string;
    codigo: string;
    periodos: Periodo[];
  };
}

const estadoLabel: Record<Periodo["estado"], string> = {
  BORRADOR: "Borrador",
  ABIERTO: "Abierto para evaluar",
  CERRADO: "Cerrado",
};

export default function EstudianteDashboard() {
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch("/api/estudiante/cursos")
      .then((r) => r.json())
      .then((d) => {
        setInscripciones(d.inscripciones ?? []);
        setCargando(false);
      });
  }, []);

  if (cargando) return <p className="text-slate-500">Cargando...</p>;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Mis cursos</h1>
        <p className="mt-1 text-slate-600">Autoevalúate y coevalúa a tus compañeros de equipo en cada periodo abierto.</p>
      </div>

      {inscripciones.length === 0 && <p className="text-slate-500">Aún no estás matriculado en ningún curso.</p>}

      <div className="flex flex-col gap-6">
        {inscripciones.map(({ curso }) => (
          <div key={curso.id} className="card">
            <h2 className="font-semibold">{curso.nombre}</h2>
            <p className="text-sm text-slate-500">Código: {curso.codigo}</p>
            {curso.periodos.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Sin periodos de evaluación todavía.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {curso.periodos.map((p) => (
                  <li key={p.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                    <div>
                      <p className="font-medium">{p.nombre}</p>
                      <p className="text-xs text-slate-500">{estadoLabel[p.estado]}</p>
                    </div>
                    {p.estado === "ABIERTO" && (
                      <Link href={`/estudiante/periodos/${p.id}/evaluar`} className="btn-primary">
                        Evaluar
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
