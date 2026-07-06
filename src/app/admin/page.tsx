"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Resumen {
  docentes: number;
  estudiantes: number;
  asignaturas: number;
  periodosAbiertos: number;
}

export default function AdminDashboard() {
  const [resumen, setResumen] = useState<Resumen | null>(null);

  useEffect(() => {
    fetch("/api/admin/resumen")
      .then((r) => r.json())
      .then(setResumen);
  }, []);

  const tarjetas = [
    { label: "Docentes", valor: resumen?.docentes, href: "/admin/docentes" },
    { label: "Estudiantes", valor: resumen?.estudiantes, href: "/admin/estudiantes" },
    { label: "Asignaturas", valor: resumen?.asignaturas, href: "/admin/asignaturas" },
    { label: "Periodos abiertos", valor: resumen?.periodosAbiertos, href: "/admin/asignaturas" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Panel de administración</h1>
        <p className="mt-1 text-slate-600">
          Crea cuentas de docentes y estudiantes, y supervisa todas las asignaturas de la plataforma.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tarjetas.map((t) => (
          <Link key={t.label} href={t.href} className="card hover:border-brand-500">
            <p className="text-sm text-slate-500">{t.label}</p>
            <p className="text-3xl font-bold">{t.valor ?? "…"}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/admin/docentes" className="card hover:border-brand-500">
          <h2 className="font-semibold">Crear docente</h2>
          <p className="mt-1 text-sm text-slate-500">Da de alta una cuenta docente con contraseña temporal.</p>
        </Link>
        <Link href="/admin/estudiantes" className="card hover:border-brand-500">
          <h2 className="font-semibold">Crear estudiante</h2>
          <p className="mt-1 text-sm text-slate-500">Da de alta una cuenta estudiante con contraseña temporal.</p>
        </Link>
      </div>
    </div>
  );
}
