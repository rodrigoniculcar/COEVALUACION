import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUsuario } from "@/lib/session";
import { requireCursoDelDocente, requireInscripcion } from "@/lib/cursos";
import { manejarError } from "@/lib/api-helpers";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const usuario = await requireUsuario();

    if (usuario.rol === "DOCENTE") {
      await requireCursoDelDocente(params.id, usuario.id);
    } else {
      await requireInscripcion(params.id, usuario.id);
    }

    const curso = await prisma.curso.findUnique({
      where: { id: params.id },
      include: {
        inscripciones: { include: { estudiante: { select: { id: true, nombre: true, email: true } } } },
        grupos: { include: { miembros: { include: { estudiante: { select: { id: true, nombre: true } } } } } },
        rubricas: { include: { criterios: true } },
        periodos: true,
      },
    });

    return NextResponse.json({ curso });
  } catch (error) {
    return manejarError(error);
  }
}
