import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDocente } from "@/lib/session";
import { requireAsignaturaDelDocente } from "@/lib/academico";
import { manejarError } from "@/lib/api-helpers";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const docente = await requireDocente();
    await requireAsignaturaDelDocente(params.id, docente.id);

    const asignatura = await prisma.asignatura.findUnique({
      where: { id: params.id },
      include: {
        secciones: {
          include: {
            periodoAcademico: true,
            _count: { select: { inscripciones: true, evaluaciones: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json({ asignatura });
  } catch (error) {
    return manejarError(error);
  }
}
