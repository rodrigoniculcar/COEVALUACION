import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDocente, ErrorAcceso } from "@/lib/session";
import { manejarError } from "@/lib/api-helpers";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const docente = await requireDocente();
    const grupo = await prisma.grupo.findUnique({ where: { id: params.id }, include: { curso: true } });
    if (!grupo) throw new ErrorAcceso("Grupo no encontrado", 404);
    if (grupo.curso.docenteId !== docente.id) throw new ErrorAcceso("No tienes acceso a este grupo", 403);

    await prisma.grupo.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return manejarError(error);
  }
}
