import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUsuario } from "@/lib/session";
import { requireSeccionDelDocente, requireInscripcion } from "@/lib/academico";
import { manejarError } from "@/lib/api-helpers";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const usuario = await requireUsuario();

    if (usuario.rol === "DOCENTE") {
      await requireSeccionDelDocente(params.id, usuario.id);
    } else {
      await requireInscripcion(params.id, usuario.id);
    }

    const seccion = await prisma.seccion.findUnique({
      where: { id: params.id },
      include: {
        asignatura: true,
        periodoAcademico: true,
        inscripciones: { include: { estudiante: { select: { id: true, nombre: true, email: true } } } },
        evaluaciones: { include: { _count: { select: { grupos: true } } }, orderBy: { createdAt: "desc" } },
      },
    });

    return NextResponse.json({ seccion });
  } catch (error) {
    return manejarError(error);
  }
}
