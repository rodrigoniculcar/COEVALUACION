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

interface EstudianteExistente {
  id: string;
  rut: string | null;
  nombre: string;
  email: string;
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

  const [busqueda, setBusqueda] = useState("");
  const [resultadosBusqueda, setResultadosBusqueda] = useState<EstudianteExistente[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [agregandoId, setAgregandoId] = useState<string | null>(null);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);

  async function cargarInscripciones() {
    const res = await fetch(`/api/secciones/${seccionId}/estudiantes`);
    const data = await res.json();
    setInscripciones(data.inscripciones ?? []);
  }

  useEffect(() => {
    cargarInscripciones();
  }, [seccionId]);

  // Cada línea: "RUT, Nombre completo, correo@ejemplo.com" (el RUT es
  // opcional: "Nombre completo, correo@ejemplo.com" también es válido).
  function parsearLinea(linea: string) {
    const partes = linea.split(",").map((v) => v.trim());
    if (partes.length >= 3) {
      const [rut, nombre, email] = partes;
      return { rut: rut || undefined, nombre, email };
    }
    const [nombre, email] = partes;
    return { rut: undefined, nombre, email };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResultado(null);

    const filas = textoCarga
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map(parsearLinea);

    if (filas.some((f) => !f.nombre || !f.email)) {
      setError('Cada línea debe tener el formato "Nombre completo, correo@ejemplo.com" (RUT opcional al inicio)');
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

      // Plantilla: RUT, Nombre completo, Correo electrónico
      const lineas = filas
        .slice(1) // saltar encabezado
        .map((fila) => [
          String(fila[0] ?? "").trim(),
          String(fila[1] ?? "").trim(),
          String(fila[2] ?? "").trim(),
        ])
        .filter(([, nombre, email]) => nombre && email)
        .map(([rut, nombre, email]) => (rut ? `${rut}, ${nombre}, ${email}` : `${nombre}, ${email}`));

      if (lineas.length === 0) {
        setErrorArchivo(
          "No se encontraron filas válidas. Usa la plantilla: RUT (opcional), nombre, correo."
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

  async function buscarEstudiantes(q: string) {
    setBusqueda(q);
    setErrorBusqueda(null);
    if (q.trim().length < 2) {
      setResultadosBusqueda([]);
      return;
    }
    setBuscando(true);
    const res = await fetch(`/api/estudiantes?q=${encodeURIComponent(q.trim())}`);
    const data = await res.json();
    setBuscando(false);
    setResultadosBusqueda(data.estudiantes ?? []);
  }

  // Agrega a un estudiante que YA existe en el sistema (encontrado por
  // nombre, apellido, correo o RUT) a esta sección. Reutiliza el mismo
  // endpoint de carga: como el correo ya existe, solo lo matricula — no
  // toca sus datos existentes (nombre/rut/contraseña).
  async function agregarExistente(est: EstudianteExistente) {
    setAgregandoId(est.id);
    setErrorBusqueda(null);
    const res = await fetch(`/api/secciones/${seccionId}/estudiantes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estudiantes: [{ nombre: est.nombre, email: est.email }] }),
    });
    const data = await res.json();
    setAgregandoId(null);
    if (!res.ok) {
      setErrorBusqueda(data.error ?? "No se pudo agregar al estudiante.");
      return;
    }
    cargarInscripciones();
  }

  const idsYaInscritos = new Set(inscripciones.map((i) => i.estudiante.id));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <VolverLink href={`/docente/asignaturas/${id}/secciones/${seccionId}`} texto="Volver a la sección" />
        <h1 className="mt-2 text-2xl font-bold">Carga de estudiantes</h1>
        <p className="mt-1 text-slate-600">
          El roster de esta sección es fijo para todas sus evaluaciones. Primero busca si el estudiante ya
          existe en el sistema; si no lo encuentras, cárgalo abajo (se crea automáticamente si el correo no
          existe).
        </p>
      </div>

      <div className="card flex flex-col gap-3">
        <h2 className="font-semibold">Buscar estudiante existente</h2>
        <p className="text-sm text-slate-600">
          Busca por nombre, apellido, correo o RUT entre todos los estudiantes ya registrados en la
          plataforma (estén o no en otra sección) y agrégalo a esta con un clic.
        </p>
        <input
          className="input max-w-md"
          placeholder="Ej. Torres, ana@correo.com, 12345678-9..."
          value={busqueda}
          onChange={(e) => buscarEstudiantes(e.target.value)}
        />
        {errorBusqueda && <p className="text-sm text-red-600">{errorBusqueda}</p>}
        {buscando && <p className="text-sm text-slate-500">Buscando...</p>}
        {!buscando && busqueda.trim().length >= 2 && (
          <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
            {resultadosBusqueda.length === 0 && (
              <li className="text-sm text-slate-500">
                Nadie coincide con &quot;{busqueda}&quot;. Si es un estudiante nuevo, cárgalo abajo.
              </li>
            )}
            {resultadosBusqueda.map((est) => {
              const yaInscrito = idsYaInscritos.has(est.id);
              return (
                <li key={est.id} className="flex items-center justify-between text-sm">
                  <span>
                    {est.nombre} <span className="text-slate-400">({est.email}{est.rut ? ` · ${est.rut}` : ""})</span>
                  </span>
                  {yaInscrito ? (
                    <span className="text-xs text-slate-400">Ya está en esta sección</span>
                  ) : (
                    <button
                      type="button"
                      className="text-xs text-brand-600 hover:underline disabled:opacity-50"
                      onClick={() => agregarExistente(est)}
                      disabled={agregandoId === est.id}
                    >
                      {agregandoId === est.id ? "Agregando..." : "Agregar a esta sección"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <form onSubmit={onSubmit} className="card flex flex-col gap-4">
        <h2 className="font-semibold">Cargar estudiantes (crea si no existen)</h2>
        <p className="text-sm text-slate-600">
          Ingresa un estudiante por línea con el formato <code>Nombre completo, correo@ejemplo.com</code>{" "}
          (RUT opcional al inicio), o importa un archivo Excel/CSV. Si el correo ya existe, solo se matricula
          — no se modifican sus datos.
        </p>
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
