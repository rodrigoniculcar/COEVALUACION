import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdministrador, ErrorAcceso } from "@/lib/session";
import { manejarError } from "@/lib/api-helpers";

// Mirror de solo lectura de GET /api/secciones/[id] pero sin exigir que la
// sección pertenezca al docente autenticado: el administrador puede ver
// cualquier sección de la plataforma (roster + evaluaciones).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdministrador();

    const seccion = await prisma.seccion.findUnique({
      where: { id: params.id },
      include: {
        asignatura: { include: { docente: { select: { id: true, nombre: true, email: true } } } },
        periodoAcademico: true,
        inscripciones: { include: { estudiante: { select: { id: true, nombre: true, email: true } } } },
        evaluaciones: { include: { _count: { select: { grupos: true } } }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!seccion) throw new ErrorAcceso("Sección no encontrada", 404);

    return NextResponse.json({ seccion });
  } catch (error) {
    return manejarError(error);
  }
}

const actualizarSeccionSchema = z.object({
  nombre: z.string().min(1).max(60),
});

// Permite al administrador corregir el nombre de una sección (ej. "Seccion A"
// mal escrito) sin depender del docente dueño.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdministrador();
    const body = actualizarSeccionSchema.parse(await req.json());

    const seccion = await prisma.seccion.update({ where: { id: params.id }, data: { nombre: body.nombre } });
    return NextResponse.json({ seccion });
  } catch (error) {
    return manejarError(error);
  }
}
