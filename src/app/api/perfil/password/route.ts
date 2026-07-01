import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUsuario, ErrorAcceso } from "@/lib/session";
import { manejarError } from "@/lib/api-helpers";

const cambiarPasswordSchema = z.object({
  passwordActual: z.string().min(1),
  passwordNueva: z.string().min(8).max(100),
});

export async function PATCH(req: NextRequest) {
  try {
    const sesion = await requireUsuario();
    const body = cambiarPasswordSchema.parse(await req.json());

    const usuario = await prisma.user.findUniqueOrThrow({ where: { id: sesion.id } });
    const passwordValida = await bcrypt.compare(body.passwordActual, usuario.passwordHash);
    if (!passwordValida) throw new ErrorAcceso("La contraseña actual no es correcta", 400);

    const passwordHash = await bcrypt.hash(body.passwordNueva, 12);
    await prisma.user.update({ where: { id: usuario.id }, data: { passwordHash } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return manejarError(error);
  }
}
