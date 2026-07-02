import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdministrador } from "@/lib/session";
import { manejarError } from "@/lib/api-helpers";

// Vista de supervisión: todos los cursos de la plataforma, sin importar el
// docente dueño (a diferencia de GET /api/cursos, que solo muestra los del
// docente autenticado).
export async function GET() {
  try {
    await requireAdministrador();

    const cursos = await prisma.curso.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        docente: { select: { id: true, nombre: true, email: true } },
        _count: { select: { inscripciones: true, grupos: true, periodos: true } },
      },
    });

    return NextResponse.json({ cursos });
  } catch (error) {
    return manejarError(error);
  }
}
