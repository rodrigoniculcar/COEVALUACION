import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdministrador, ErrorAcceso } from "@/lib/session";
import { manejarError } from "@/lib/api-helpers";

const inscribirSchema = z.object({
  estudianteId: z.string(),
});

// Permite al administrador matricular a cualquier estudiante en cualquier
// curso de la plataforma, sin pasar por el docente dueño del curso.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdministrador();
    const body = inscribirSchema.parse(await req.json());

    const [curso, estudiante] = await Promise.all([
      prisma.curso.findUnique({ where: { id: params.id } }),
      prisma.user.findUnique({ where: { id: body.estudianteId } }),
    ]);
    if (!curso) throw new ErrorAcceso("Curso no encontrado", 404);
    if (!estudiante || estudiante.rol !== "ESTUDIANTE") {
      throw new ErrorAcceso("El usuario indicado no es una cuenta de estudiante", 400);
    }

    const inscripcion = await prisma.inscripcion.upsert({
      where: { cursoId_estudianteId: { cursoId: curso.id, estudianteId: estudiante.id } },
      create: { cursoId: curso.id, estudianteId: estudiante.id },
      update: {},
    });

    return NextResponse.json({ inscripcion }, { status: 201 });
  } catch (error) {
    return manejarError(error);
  }
}
