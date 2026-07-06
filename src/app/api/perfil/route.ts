import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUsuario } from "@/lib/session";
import { manejarError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const sesion = await requireUsuario();
    const usuario = await prisma.user.findUniqueOrThrow({
      where: { id: sesion.id },
      select: { id: true, nombre: true, email: true, rol: true, rut: true, fotoUrl: true },
    });
    return NextResponse.json(usuario);
  } catch (error) {
    return manejarError(error);
  }
}

// Solo la foto es editable desde acá; nombre/correo los administra el
// administrador para mantener consistencia con los RUT/correos institucionales
// cargados en bloque.
const actualizarPerfilSchema = z.object({
  fotoUrl: z.string().startsWith("data:image/").max(500_000).nullable(),
});

export async function PATCH(req: NextRequest) {
  try {
    const sesion = await requireUsuario();
    const body = actualizarPerfilSchema.parse(await req.json());
    await prisma.user.update({ where: { id: sesion.id }, data: { fotoUrl: body.fotoUrl } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return manejarError(error);
  }
}
