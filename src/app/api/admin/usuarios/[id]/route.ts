import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdministrador, ErrorAcceso } from "@/lib/session";
import { manejarError } from "@/lib/api-helpers";

const actualizarUsuarioSchema = z.object({
  activo: z.boolean().optional(),
  // Permite al administrador corregir errores de tipeo en el nombre de un
  // docente o estudiante (ej. tildes, apellidos mal escritos).
  nombre: z.string().min(2).max(120).optional(),
});

// Activar/desactivar una cuenta docente o estudiante, y/o corregir su
// nombre. No se permite modificar cuentas ADMINISTRADOR desde aquí (evita
// bloqueos accidentales de la administración de la plataforma); para eso se
// gestiona directo en la base de datos.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdministrador();
    const body = actualizarUsuarioSchema.parse(await req.json());

    const usuario = await prisma.user.findUnique({ where: { id: params.id } });
    if (!usuario) throw new ErrorAcceso("Usuario no encontrado", 404);
    if (usuario.rol === "ADMINISTRADOR") {
      throw new ErrorAcceso("No se puede modificar una cuenta administradora desde este panel", 400);
    }
    if (body.activo !== undefined && usuario.id === admin.id) {
      throw new ErrorAcceso("No puedes desactivar tu propia cuenta", 400);
    }

    const actualizado = await prisma.user.update({
      where: { id: params.id },
      data: { activo: body.activo, nombre: body.nombre },
      select: { id: true, nombre: true, email: true, rol: true, activo: true },
    });

    return NextResponse.json({ usuario: actualizado });
  } catch (error) {
    return manejarError(error);
  }
}
