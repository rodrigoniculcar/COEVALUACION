import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDocente } from "@/lib/session";
import { requirePeriodoDelDocente } from "@/lib/academico";
import { manejarError } from "@/lib/api-helpers";

export async function DELETE(_req: Request, { params }: { params: { id: string; docenteId: string } }) {
  try {
    const docente = await requireDocente();
    await requirePeriodoDelDocente(params.id, docente.id);

    await prisma.docenteEvaluador.deleteMany({
      where: { periodoId: params.id, docenteId: params.docenteId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return manejarError(error);
  }
}
