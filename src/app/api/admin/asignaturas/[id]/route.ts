import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdministrador, ErrorAcceso } from "@/lib/session";
import { manejarError } from "@/lib/api-helpers";

// Detalle de una asignatura para la vista de supervisión del administrador:
// quién es el docente dueño y todas sus secciones, para poder "entrar" a
// verla igual que el propio docente (ver /admin/asignaturas/[id]).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdministrador();

    const asignatura = await prisma.asignatura.findUnique({
      where: { id: params.id },
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
    if (!asignatura) throw new ErrorAcceso("Asignatura no encontrada", 404);

    return NextResponse.json({ asignatura });
  } catch (error) {
    return manejarError(error);
  }
}

const actualizarAsignaturaSchema = z.object({
  nombre: z.string().min(2).max(120).optional(),
  codigo: z.string().min(1).max(20).optional(),
});

// Permite al administrador corregir errores de tipeo en el nombre/código de
// una asignatura sin tener que pasar por el docente dueño.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdministrador();
    const body = actualizarAsignaturaSchema.parse(await req.json());

    const asignatura = await prisma.asignatura.update({
      where: { id: params.id },
      data: body,
    });

    return NextResponse.json({ asignatura });
  } catch (error) {
    return manejarError(error);
  }
}
