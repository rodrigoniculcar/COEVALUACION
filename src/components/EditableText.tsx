"use client";

import type { ReactNode } from "react";
import { useState } from "react";

// Campo de texto editable in-place: se muestra como texto plano (o el
// contenido de `children`, ej. un Link navegable) con un lápiz al lado; al
// hacer clic se convierte en un input. Usado en el panel de administración
// para corregir errores de tipeo (nombres, códigos, etc.) sin tener que
// armar un formulario completo por cada campo.
export function EditableText({
  value,
  onSave,
  className,
  inputClassName,
  children,
}: {
  value: string;
  onSave: (nuevoValor: string) => Promise<void> | void;
  className?: string;
  inputClassName?: string;
  children?: ReactNode;
}) {
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(value);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    const nuevoValor = borrador.trim();
    if (!nuevoValor || nuevoValor === value) {
      setEditando(false);
      setBorrador(value);
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await onSave(nuevoValor);
      setEditando(false);
    } catch {
      setError("No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  if (editando) {
    return (
      <span className="inline-flex flex-col gap-1">
        <span className="inline-flex items-center gap-1">
          <input
            autoFocus
            className={inputClassName ?? "input h-8 py-1 text-sm"}
            value={borrador}
            disabled={guardando}
            onChange={(e) => setBorrador(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") guardar();
              if (e.key === "Escape") {
                setEditando(false);
                setBorrador(value);
              }
            }}
          />
          <button
            type="button"
            className="text-xs text-brand-600 hover:underline disabled:opacity-50"
            onClick={guardar}
            disabled={guardando}
          >
            {guardando ? "..." : "Guardar"}
          </button>
          <button
            type="button"
            className="text-xs text-slate-500 hover:underline"
            onClick={() => {
              setEditando(false);
              setBorrador(value);
            }}
          >
            Cancelar
          </button>
        </span>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </span>
    );
  }

  return (
    <span className={`group inline-flex items-center gap-1.5 ${className ?? ""}`}>
      {children ?? value}
      <button
        type="button"
        aria-label="Editar"
        className="text-slate-300 opacity-0 hover:text-brand-600 group-hover:opacity-100"
        onClick={() => setEditando(true)}
      >
        ✎
      </button>
    </span>
  );
}
