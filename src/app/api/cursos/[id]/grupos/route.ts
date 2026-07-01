import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireDocente } from "@/lib/session";
import { requireCursoDelDocente } from "@/lib/cursos";
import { manejarError } from "@/lib/api-helpers";
import { ErrorAcceso } from "@/lib/session";

const crearGrupoSchema = z.object({
  nombre: z.string().min(1).max(80),
  estudianteIds: z.array(z.string()).min(1).max(50),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const docente = await requireDocente();
    await requireCursoDelDocente(params.id, docente.id);

    const grupos = await prisma.grupo.findMany({
      where: { cursoId: params.id },
      include: { miembros: { include: { estudiante: { select: { id: true, nombre: true, email: true } } } } },
      orderBy: { nombre: "asc" },
    });

    return NextResponse.json({ grupos });
  } catch (error) {
    return manejarError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const docente = await requireDocente();
    await requireCursoDelDocente(params.id, docente.id);
    const body = crearGrupoSchema.parse(await req.json());

    const inscritos = await prisma.inscripcion.findMany({
      where: { cursoId: params.id, estudianteId: { in: body.estudianteIds } },
    });
    if (inscritos.length !== body.estudianteIds.length) {
      throw new ErrorAcceso("Uno o más estudiantes no están inscritos en este curso", 400);
    }

    const grupo = await prisma.grupo.create({
      data: {
        cursoId: params.id,
        nombre: body.nombre,
        miembros: { create: body.estudianteIds.map((estudianteId) => ({ estudianteId })) },
      },
      include: { miembros: { include: { estudiante: { select: { id: true, nombre: true } } } } },
    });

    return NextResponse.json({ grupo }, { status: 201 });
  } catch (error) {
    return manejarError(error);
  }
}
