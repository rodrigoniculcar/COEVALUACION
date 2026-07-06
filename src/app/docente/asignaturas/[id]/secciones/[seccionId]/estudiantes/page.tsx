"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { VolverLink } from "@/components/VolverLink";

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

export default function EstudiantesSeccionPage() {
  const { id, seccionId } = useParams<{ id: string; seccionId: string }>();
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [textoCarga, setTextoCarga] = useState("");
  const [resultado, setResultado] = useState<ResultadoCarga[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [restableciendoId, setRestableciendoId] = useState<string | null>(null);
  const [passwordRestablecida, setPasswordRestablecida] = useState<{ email: string; password: string } | null>(
    null
  );
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  async function cargarInscripciones() {
    const res = await fetch(`/api/secciones/${seccionId}/estudiantes`);
    const data = await res.json();
    setInscripciones(data.inscripciones ?? []);
  }

  useEffect(() => {
    cargarInscripciones();
  }, [seccionId]);

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
    const res = await fetch(`/api/secciones/${seccionId}/estudiantes`, {
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

  // El archivo se procesa por completo en el navegador: nunca se sube el
  // binario al servidor. Solo se extraen nombre/correo y se vuelcan al mismo
  // cuadro de texto que ya usa la carga manual, así se reutiliza la misma
  // validación y el mismo endpoint.
  async function onArchivoSeleccionado(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setErrorArchivo(null);

    try {
      const XLSX = await import("xlsx");
      const buffer = await archivo.arrayBuffer();
      const libro = XLSX.read(buffer, { type: "array" });
      const hoja = libro.Sheets[libro.SheetNames[0]];
      const filas: unknown[][] = XLSX.utils.sheet_to_json(hoja, { header: 1 });

      const lineas = filas
        .slice(1) // saltar encabezado
        .map((fila) => [String(fila[0] ?? "").trim(), String(fila[1] ?? "").trim()])
        .filter(([nombre, email]) => nombre && email)
        .map(([nombre, email]) => `${nombre}, ${email}`);

      if (lineas.length === 0) {
        setErrorArchivo(
          "No se encontraron filas válidas. Usa la plantilla: primera columna = nombre, segunda = correo."
        );
        return;
      }

      setTextoCarga((prev) => (prev ? `${prev}\n${lineas.join("\n")}` : lineas.join("\n")));
    } catch {
      setErrorArchivo("No se pudo leer el archivo. Verifica que sea un .xlsx o .csv válido.");
    } finally {
      if (inputArchivoRef.current) inputArchivoRef.current.value = "";
    }
  }

  async function restablecerPassword(estudianteId: string) {
    setRestableciendoId(estudianteId);
    setPasswordRestablecida(null);
    const res = await fetch(`/api/secciones/${seccionId}/estudiantes/${estudianteId}/restablecer-password`, {
      method: "POST",
    });
    const data = await res.json();
    setRestableciendoId(null);

    if (!res.ok) {
      setError(data.error ?? "No se pudo restablecer la contraseña.");
      return;
    }

    setPasswordRestablecida({ email: data.email, password: data.passwordTemporal });
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <VolverLink href={`/docente/asignaturas/${id}/secciones/${seccionId}`} texto="Volver a la sección" />
        <h1 className="mt-2 text-2xl font-bold">Carga de estudiantes</h1>
        <p className="mt-1 text-slate-600">
          El roster de esta sección es fijo para todas sus evaluaciones. Ingresa un estudiante por línea con
          el formato <code>Nombre completo, correo@ejemplo.com</code>, o importa un archivo Excel/CSV. Si el
          correo no existe se crea una cuenta con contraseña temporal.
        </p>
      </div>

      <form onSubmit={onSubmit} className="card flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <a href="/plantilla-estudiantes.xlsx" download className="btn-secondary">
            Descargar plantilla Excel
          </a>
          <label className="btn-secondary cursor-pointer">
            Importar desde Excel/CSV
            <input
              ref={inputArchivoRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={onArchivoSeleccionado}
            />
          </label>
          {errorArchivo && <p className="text-sm text-red-600">{errorArchivo}</p>}
        </div>

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

      {passwordRestablecida && (
        <div className="card border-amber-300 bg-amber-50">
          <p className="text-sm text-amber-800">
            Nueva contraseña para <strong>{passwordRestablecida.email}</strong>. Compártela ahora: no se podrá
            volver a mostrar (la anterior deja de funcionar).
          </p>
          <p className="mt-2 font-mono text-lg">{passwordRestablecida.password}</p>
        </div>
      )}

      <div className="card">
        <h2 className="font-semibold">Estudiantes matriculados ({inscripciones.length})</h2>
        <p className="mt-1 text-xs text-slate-500">
          Por seguridad no es posible ver la contraseña actual de un estudiante (solo se guarda de forma
          cifrada). Si la necesita, restablécela y comparte la nueva.
        </p>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-1">Nombre</th>
              <th>Correo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {inscripciones.map((i) => (
              <tr key={i.estudiante.id} className="border-t border-slate-100">
                <td className="py-2">{i.estudiante.nombre}</td>
                <td className="text-slate-500">{i.estudiante.email}</td>
                <td className="text-right">
                  <button
                    className="text-xs text-brand-600 hover:underline disabled:opacity-50"
                    onClick={() => restablecerPassword(i.estudiante.id)}
                    disabled={restableciendoId === i.estudiante.id}
                  >
                    {restableciendoId === i.estudiante.id ? "Restableciendo..." : "Restablecer contraseña"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
