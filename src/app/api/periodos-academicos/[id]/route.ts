import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdministrador, ErrorAcceso } from "@/lib/session";
import { manejarError } from "@/lib/api-helpers";

// Marca este año-semestre como el vigente (y desmarca cualquier otro, ya
// que solo puede haber uno actual a la vez). Es una decisión de la
// plataforma en su conjunto, por eso la gestiona el administrador y no
// cada docente por separado.
export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdministrador();

    const periodoAcademico = await prisma.periodoAcademico.findUnique({ where: { id: params.id } });
    if (!periodoAcademico) throw new ErrorAcceso("Año-semestre no encontrado", 404);

    const [, actualizado] = await prisma.$transaction([
      prisma.periodoAcademico.updateMany({ where: { actual: true }, data: { actual: false } }),
      prisma.periodoAcademico.update({ where: { id: params.id }, data: { actual: true } }),
    ]);

    return NextResponse.json({ periodoAcademico: actualizado });
  } catch (error) {
    return manejarError(error);
  }
}
