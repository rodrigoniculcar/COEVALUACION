"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

interface Perfil {
  id: string;
  nombre: string;
  email: string;
  rol: "ADMINISTRADOR" | "DOCENTE" | "ESTUDIANTE";
  rut: string | null;
  fotoUrl: string | null;
}

const rolLabel: Record<Perfil["rol"], string> = {
  ADMINISTRADOR: "Administrador",
  DOCENTE: "Docente",
  ESTUDIANTE: "Estudiante",
};

const TAMANO_FOTO = 256;

// Redimensiona y recorta la imagen a un cuadrado de TAMANO_FOTO px en el
// navegador (canvas) y la re-codifica en JPEG antes de subirla, para no
// almacenar en la base de datos archivos pesados sin comprimir.
function comprimirImagen(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error("No se pudo leer el archivo."));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("El archivo no es una imagen válida."));
      img.onload = () => {
        const lado = Math.min(img.width, img.height);
        const canvas = document.createElement("canvas");
        canvas.width = TAMANO_FOTO;
        canvas.height = TAMANO_FOTO;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("No se pudo procesar la imagen."));
        ctx.drawImage(
          img,
          (img.width - lado) / 2,
          (img.height - lado) / 2,
          lado,
          lado,
          0,
          0,
          TAMANO_FOTO,
          TAMANO_FOTO
        );
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = lector.result as string;
    };
    lector.readAsDataURL(archivo);
  });
}

export default function PerfilPage() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const inputFotoRef = useRef<HTMLInputElement>(null);

  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [passwordConfirmar, setPasswordConfirmar] = useState("");
  const [errorPassword, setErrorPassword] = useState<string | null>(null);
  const [mensajePassword, setMensajePassword] = useState<string | null>(null);
  const [guardandoPassword, setGuardandoPassword] = useState(false);

  useEffect(() => {
    fetch("/api/perfil")
      .then((r) => r.json())
      .then(setPerfil);
  }, []);

  async function onSeleccionarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    setErrorFoto(null);
    setSubiendoFoto(true);
    try {
      const fotoUrl = await comprimirImagen(archivo);
      const res = await fetch("/api/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fotoUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar la foto.");
      setPerfil((prev) => (prev ? { ...prev, fotoUrl } : prev));
    } catch (err) {
      setErrorFoto(err instanceof Error ? err.message : "No se pudo guardar la foto.");
    } finally {
      setSubiendoFoto(false);
    }
  }

  async function quitarFoto() {
    setSubiendoFoto(true);
    setErrorFoto(null);
    const res = await fetch("/api/perfil", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fotoUrl: null }),
    });
    setSubiendoFoto(false);
    if (!res.ok) {
      setErrorFoto("No se pudo quitar la foto.");
      return;
    }
    setPerfil((prev) => (prev ? { ...prev, fotoUrl: null } : prev));
  }

  async function onCambiarPassword(e: FormEvent) {
    e.preventDefault();
    setErrorPassword(null);
    setMensajePassword(null);

    if (passwordNueva !== passwordConfirmar) {
      setErrorPassword("La confirmación no coincide con la contraseña nueva.");
      return;
    }

    setGuardandoPassword(true);
    const res = await fetch("/api/perfil/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passwordActual, passwordNueva }),
    });
    const data = await res.json();
    setGuardandoPassword(false);

    if (!res.ok) {
      setErrorPassword(data.error ?? "No se pudo cambiar la contraseña.");
      return;
    }

    setMensajePassword("Contraseña actualizada.");
    setPasswordActual("");
    setPasswordNueva("");
    setPasswordConfirmar("");
  }

  if (!perfil) return <p className="text-slate-500">Cargando...</p>;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Mi perfil</h1>
        <p className="mt-1 text-slate-600">Tus datos, foto y contraseña de acceso.</p>
      </div>

      <div className="card flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="flex flex-col items-center gap-2">
          <div className="h-24 w-24 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
            {perfil.fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={perfil.fotoUrl} alt={perfil.nombre} className="h-full w-full object-cover" />
            ) : (
              <svg viewBox="0 0 24 24" className="h-full w-full p-4 text-slate-300" fill="currentColor">
                <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.42 0-8 2.24-8 5v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1c0-2.76-3.58-5-8-5Z" />
              </svg>
            )}
          </div>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              className="btn-secondary"
              disabled={subiendoFoto}
              onClick={() => inputFotoRef.current?.click()}
            >
              {subiendoFoto ? "Subiendo..." : "Cambiar foto"}
            </button>
            {perfil.fotoUrl && (
              <button type="button" className="btn-secondary" disabled={subiendoFoto} onClick={quitarFoto}>
                Quitar
              </button>
            )}
          </div>
          <input
            ref={inputFotoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onSeleccionarFoto}
          />
          {errorFoto && <p className="text-xs text-red-600">{errorFoto}</p>}
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <div>
            <span className="label">Nombre</span>
            <p className="font-medium text-slate-900">{perfil.nombre}</p>
          </div>
          <div>
            <span className="label">Correo</span>
            <p className="font-medium text-slate-900">{perfil.email}</p>
          </div>
          <div>
            <span className="label">Rol</span>
            <p className="font-medium text-slate-900">{rolLabel[perfil.rol]}</p>
          </div>
          {perfil.rut && (
            <div>
              <span className="label">RUT</span>
              <p className="font-medium text-slate-900">{perfil.rut}</p>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={onCambiarPassword} className="card flex max-w-sm flex-col gap-4">
        <h2 className="font-semibold">Cambiar contraseña</h2>
        <div>
          <label className="label">Contraseña actual</label>
          <input
            type="password"
            className="input"
            value={passwordActual}
            onChange={(e) => setPasswordActual(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Contraseña nueva</label>
          <input
            type="password"
            className="input"
            value={passwordNueva}
            onChange={(e) => setPasswordNueva(e.target.value)}
            minLength={8}
            required
          />
        </div>
        <div>
          <label className="label">Confirmar contraseña nueva</label>
          <input
            type="password"
            className="input"
            value={passwordConfirmar}
            onChange={(e) => setPasswordConfirmar(e.target.value)}
            minLength={8}
            required
          />
        </div>
        {errorPassword && <p className="text-sm text-red-600">{errorPassword}</p>}
        {mensajePassword && <p className="text-sm text-emerald-600">{mensajePassword}</p>}
        <button className="btn-primary" disabled={guardandoPassword}>
          {guardandoPassword ? "Guardando..." : "Actualizar contraseña"}
        </button>
      </form>
    </div>
  );
}
