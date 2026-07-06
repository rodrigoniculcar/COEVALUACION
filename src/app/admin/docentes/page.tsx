"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";

interface Docente {
  id: string;
  rut: string | null;
  nombre: string;
  email: string;
  activo: boolean;
  _count: { asignaturas: number };
}

interface ResultadoCarga {
  email: string;
  estado: string;
  nombre?: string;
  passwordTemporal?: string | null;
  motivo?: string;
}

export default function AdminDocentesPage() {
  const [docentes, setDocentes] = useState<Docente[]>([]);
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
    const res = await fetch("/api/admin/docentes");
    const data = await res.json();
    setDocentes(data.docentes ?? []);
  }

  useEffect(() => {
    cargar();
  }, []);

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
    const res = await fetch("/api/admin/docentes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        docentes: filas,
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

  async function toggleActivo(id: string, activo: boolean) {
    await fetch(`/api/admin/usuarios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !activo }),
    });
    cargar();
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Docentes</h1>
        <p className="mt-1 text-slate-600">
          Crea cuentas docente directamente, sin pasar por el registro público, de forma manual o masiva
          (Excel/CSV).
        </p>
      </div>

      <form onSubmit={onSubmit} className="card flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <a href="/plantilla-docentes.xlsx" download className="btn-secondary">
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
            "11111111-1, María Fernández, maria.fernandez@correo.com\nJorge Salinas, jorge.salinas@correo.com"
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
            Se asigna a todos los docentes nuevos de esta carga (mínimo 8 caracteres).
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary self-start" disabled={cargando}>
          {cargando ? "Procesando..." : "Cargar docentes"}
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

      <div className="card">
        <h2 className="font-semibold">Docentes registrados ({docentes.length})</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-1">RUT</th>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Asignaturas</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {docentes.map((d) => (
              <tr key={d.id} className="border-t border-slate-100">
                <td className="py-2 text-slate-500">{d.rut ?? "—"}</td>
                <td>{d.nombre}</td>
                <td className="text-slate-500">{d.email}</td>
                <td>{d._count.asignaturas}</td>
                <td>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      d.activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {d.activo ? "Activo" : "Desactivado"}
                  </span>
                </td>
                <td className="flex flex-col items-end gap-1 py-2 text-right">
                  <button
                    className="text-xs text-brand-600 hover:underline"
                    onClick={() => toggleActivo(d.id, d.activo)}
                  >
                    {d.activo ? "Desactivar" : "Reactivar"}
                  </button>
                  <button
                    className="text-xs text-brand-600 hover:underline disabled:opacity-50"
                    onClick={() => restablecerPassword(d.id)}
                    disabled={restableciendoId === d.id}
                  >
                    {restableciendoId === d.id ? "Restableciendo..." : "Restablecer contraseña"}
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
