import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdministrador, ErrorAcceso } from "@/lib/session";
import { manejarError } from "@/lib/api-helpers";

const actualizarUsuarioSchema = z.object({
  activo: z.boolean(),
});

// Activar/desactivar una cuenta docente o estudiante. No se permite
// desactivar cuentas ADMINISTRADOR desde aquí (evita bloqueos accidentales
// de la administración de la plataforma); para eso se gestiona directo en
// la base de datos.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdministrador();
    const body = actualizarUsuarioSchema.parse(await req.json());

    const usuario = await prisma.user.findUnique({ where: { id: params.id } });
    if (!usuario) throw new ErrorAcceso("Usuario no encontrado", 404);
    if (usuario.rol === "ADMINISTRADOR") {
      throw new ErrorAcceso("No se puede desactivar una cuenta administradora desde este panel", 400);
    }
    if (usuario.id === admin.id) {
      throw new ErrorAcceso("No puedes desactivar tu propia cuenta", 400);
    }

    const actualizado = await prisma.user.update({
      where: { id: params.id },
      data: { activo: body.activo },
      select: { id: true, nombre: true, email: true, rol: true, activo: true },
    });

    return NextResponse.json({ usuario: actualizado });
  } catch (error) {
    return manejarError(error);
  }
}
