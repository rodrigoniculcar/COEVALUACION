"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { EditableText } from "@/components/EditableText";

interface Estudiante {
  id: string;
  rut: string | null;
  nombre: string;
  email: string;
  activo: boolean;
  cursosEsteSemestre: number;
  _count: { inscripciones: number };
}

interface ResultadoCarga {
  email: string;
  estado: string;
  nombre?: string;
  passwordTemporal?: string | null;
  motivo?: string;
}

interface ResultadoReseteoMasivo {
  id: string;
  email: string;
  estado: "restablecido" | "omitido";
  passwordTemporal: string | null;
}

export default function AdminEstudiantesPage() {
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [periodoActualNombre, setPeriodoActualNombre] = useState<string | null>(null);
  const [soloActivos, setSoloActivos] = useState(false);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [passwordMasiva, setPasswordMasiva] = useState("");
  const [restableciendoMasivo, setRestableciendoMasivo] = useState(false);
  const [resultadoMasivo, setResultadoMasivo] = useState<ResultadoReseteoMasivo[] | null>(null);

  const [textoCarga, setTextoCarga] = useState("");
  const [passwordGenerica, setPasswordGenerica] = useState("");
  const [resultado, setResultado] = useState<ResultadoCarga[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [restableciendoId, setRestableciendoId] = useState<string | null>(null);
  const [passwordRestablecida, setPasswordRestablecida] = useState<{ email: string; password: string } | null>(
    null
  );
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  async function cargar() {
    const res = await fetch("/api/admin/estudiantes");
    const data = await res.json();
    setEstudiantes(data.estudiantes ?? []);
    setPeriodoActualNombre(data.periodoActualNombre ?? null);
  }

  useEffect(() => {
    cargar();
  }, []);

  const estudiantesFiltrados = useMemo(
    () => (soloActivos ? estudiantes.filter((e) => e.activo) : estudiantes),
    [estudiantes, soloActivos]
  );

  const todosSeleccionados =
    estudiantesFiltrados.length > 0 && estudiantesFiltrados.every((e) => seleccionados.has(e.id));

  function toggleSeleccionTodos() {
    if (todosSeleccionados) {
      setSeleccionados(new Set());
    } else {
      setSeleccionados(new Set(estudiantesFiltrados.map((e) => e.id)));
    }
  }

  function toggleSeleccion(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
    const res = await fetch("/api/admin/estudiantes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        estudiantes: filas,
        passwordGenerica: passwordGenerica.trim() || undefined,
      }),
    });
    const data = await res.json();
    setCargando(false);

    if (!res.ok) {
      setError(data.error ?? "No se pudo procesar la carga.");
      return;
    }

    setResultado(data.resultado);
    setTextoCarga("");
    cargar();
  }

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
        .slice(1)
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

  async function restablecerPassword(id: string) {
    setRestableciendoId(id);
    setPasswordRestablecida(null);
    const res = await fetch(`/api/admin/usuarios/${id}/restablecer-password`, { method: "POST" });
    const data = await res.json();
    setRestableciendoId(null);

    if (!res.ok) {
      setError(data.error ?? "No se pudo restablecer la contraseña.");
      return;
    }

    setPasswordRestablecida({ email: data.email, password: data.passwordTemporal });
  }

  async function restablecerSeleccionados() {
    if (seleccionados.size === 0) return;
    setRestableciendoMasivo(true);
    setResultadoMasivo(null);
    const res = await fetch("/api/admin/usuarios/restablecer-password-masivo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: Array.from(seleccionados),
        passwordGenerica: passwordMasiva.trim() || undefined,
      }),
    });
    const data = await res.json();
    setRestableciendoMasivo(false);

    if (!res.ok) {
      setError(data.error ?? "No se pudo restablecer las contraseñas seleccionadas.");
      return;
    }

    setResultadoMasivo(data.resultado);
    setSeleccionados(new Set());
  }

  async function toggleActivo(id: string, activo: boolean) {
    await fetch(`/api/admin/usuarios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !activo }),
    });
    cargar();
  }

  async function renombrar(id: string, nombre: string) {
    const res = await fetch(`/api/admin/usuarios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    });
    if (!res.ok) throw new Error("No se pudo renombrar");
    cargar();
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Estudiantes</h1>
        <p className="mt-1 text-slate-600">
          Crea cuentas de estudiante de forma manual o masiva (Excel/CSV). La matrícula a una sección
          específica la hace el docente desde su sección, o tú desde <span className="font-medium">Asignaturas</span>.
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
          placeholder={
            "12345678-9, Ana Torres, ana.torres@correo.com\nLuis Pérez, luis.perez@correo.com"
          }
          value={textoCarga}
          onChange={(e) => setTextoCarga(e.target.value)}
        />

        <div className="max-w-xs">
          <label className="label">Contraseña genérica (opcional)</label>
          <input
            className="input"
            placeholder="Si la dejas vacía, cada uno recibe una distinta"
            value={passwordGenerica}
            onChange={(e) => setPasswordGenerica(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">
            Se asigna a todos los estudiantes nuevos de esta carga (mínimo 8 caracteres).
          </p>
        </div>

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
                  <td>
                    {r.estado === "creado"
                      ? "Creado"
                      : r.estado === "existente"
                        ? "Ya existía (sin cambios)"
                        : `Omitido (${r.motivo})`}
                  </td>
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

      {resultadoMasivo && (
        <div className="card border-amber-300 bg-amber-50">
          <p className="text-sm font-medium text-amber-800">
            Copia y comparte las contraseñas nuevas ahora: no se podrán volver a mostrar.
          </p>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-1">Correo</th>
                <th>Estado</th>
                <th>Contraseña nueva</th>
              </tr>
            </thead>
            <tbody>
              {resultadoMasivo.map((r) => (
                <tr key={r.id} className="border-t border-amber-200">
                  <td className="py-1">{r.email}</td>
                  <td>{r.estado === "restablecido" ? "Restablecida" : "Omitido"}</td>
                  <td className="font-mono">{r.passwordTemporal ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">
            Estudiantes ({estudiantesFiltrados.length}
            {soloActivos ? ` de ${estudiantes.length}` : ""})
            {periodoActualNombre && (
              <span className="ml-2 text-sm font-normal text-slate-500">
                · Cursos este semestre: {periodoActualNombre}
              </span>
            )}
          </h2>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={soloActivos} onChange={(e) => setSoloActivos(e.target.checked)} />
            Mostrar solo activos
          </label>
        </div>

        {seleccionados.size > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 p-3">
            <span className="text-sm font-medium text-brand-700">{seleccionados.size} seleccionado(s)</span>
            <input
              className="input max-w-[220px]"
              placeholder="Contraseña genérica (opcional)"
              value={passwordMasiva}
              onChange={(e) => setPasswordMasiva(e.target.value)}
            />
            <button
              className="btn-primary"
              onClick={restablecerSeleccionados}
              disabled={restableciendoMasivo}
            >
              {restableciendoMasivo ? "Restableciendo..." : "Restablecer contraseña de seleccionados"}
            </button>
          </div>
        )}

        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-1">
                <input type="checkbox" checked={todosSeleccionados} onChange={toggleSeleccionTodos} />
              </th>
              <th>RUT</th>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Secciones inscritas</th>
              <th>Cursos este semestre</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {estudiantesFiltrados.map((est) => (
              <tr key={est.id} className="border-t border-slate-100">
                <td className="py-2">
                  <input
                    type="checkbox"
                    checked={seleccionados.has(est.id)}
                    onChange={() => toggleSeleccion(est.id)}
                  />
                </td>
                <td className="text-slate-500">{est.rut ?? "—"}</td>
                <td>
                  <EditableText value={est.nombre} onSave={(nuevo) => renombrar(est.id, nuevo)}>
                    <Link href={`/admin/estudiantes/${est.id}`} className="font-medium text-brand-600 hover:underline">
                      {est.nombre}
                    </Link>
                  </EditableText>
                </td>
                <td className="text-slate-500">{est.email}</td>
                <td>{est._count.inscripciones}</td>
                <td>{est.cursosEsteSemestre}</td>
                <td>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      est.activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {est.activo ? "Activo" : "Desactivado"}
                  </span>
                </td>
                <td className="flex flex-col items-end gap-1 py-2 text-right">
                  <button
                    className="text-xs text-brand-600 hover:underline"
                    onClick={() => toggleActivo(est.id, est.activo)}
                  >
                    {est.activo ? "Desactivar" : "Reactivar"}
                  </button>
                  <button
                    className="text-xs text-brand-600 hover:underline disabled:opacity-50"
                    onClick={() => restablecerPassword(est.id)}
                    disabled={restableciendoId === est.id}
                  >
                    {restableciendoId === est.id ? "Restableciendo..." : "Restablecer contraseña"}
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
