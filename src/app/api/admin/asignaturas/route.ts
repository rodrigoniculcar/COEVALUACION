import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdministrador } from "@/lib/session";
import { manejarError } from "@/lib/api-helpers";

// Vista de supervisión: todas las asignaturas de la plataforma, sin
// importar el docente dueño (a diferencia de GET /api/asignaturas, que
// solo muestra las del docente autenticado), junto con sus secciones para
// poder matricular estudiantes en cualquiera de ellas.
export async function GET() {
  try {
    await requireAdministrador();

    const asignaturas = await prisma.asignatura.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        docente: { select: { id: true, nombre: true, email: true } },
        secciones: {
          include: {
            periodoAcademico: true,
            _count: { select: { inscripciones: true, evaluaciones: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json({ asignaturas });
  } catch (error) {
    return manejarError(error);
  }
}
