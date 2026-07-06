import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function getSesionActual() {
  return getServerSession(authOptions);
}

export class ErrorAcceso extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

// Helpers usados por los API routes para exigir un rol antes de tocar la
// base de datos. Lanzan ErrorAcceso, que las rutas traducen a un status HTTP.
export async function requireDocente() {
  const session = await getSesionActual();
  if (!session?.user) throw new ErrorAcceso("No autenticado", 401);
  if (session.user.rol !== "DOCENTE") throw new ErrorAcceso("Requiere rol docente", 403);
  return session.user;
}

export async function requireEstudiante() {
  const session = await getSesionActual();
  if (!session?.user) throw new ErrorAcceso("No autenticado", 401);
  if (session.user.rol !== "ESTUDIANTE") throw new ErrorAcceso("Requiere rol estudiante", 403);
  return session.user;
}

export async function requireUsuario() {
  const session = await getSesionActual();
  if (!session?.user) throw new ErrorAcceso("No autenticado", 401);
  return session.user;
}

export async function requireAdministrador() {
  const session = await getSesionActual();
  if (!session?.user) throw new ErrorAcceso("No autenticado", 401);
  if (session.user.rol !== "ADMINISTRADOR") throw new ErrorAcceso("Requiere rol administrador", 403);
  return session.user;
}

// El catálogo de años-semestre lo puede gestionar tanto un docente (al
// armar sus secciones) como el administrador (desde su panel).
export async function requireDocenteOAdministrador() {
  const session = await getSesionActual();
  if (!session?.user) throw new ErrorAcceso("No autenticado", 401);
  if (session.user.rol !== "DOCENTE" && session.user.rol !== "ADMINISTRADOR") {
    throw new ErrorAcceso("Requiere rol docente o administrador", 403);
  }
  return session.user;
}
