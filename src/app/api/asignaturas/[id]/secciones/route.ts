import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireDocente } from "@/lib/session";
import { requireAsignaturaDelDocente } from "@/lib/academico";
import { manejarError } from "@/lib/api-helpers";

const crearSeccionSchema = z.object({
  nombre: z.string().min(1).max(80),
  periodoAcademicoId: z.string(),
});

// Una sección es la oferta concreta de una asignatura en un año-semestre,
// con su propio roster fijo de estudiantes. Se puede filtrar/buscar por
// periodo académico desde la UI usando el include de periodoAcademico.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const docente = await requireDocente();
    await requireAsignaturaDelDocente(params.id, docente.id);

    const secciones = await prisma.seccion.findMany({
      where: { asignaturaId: params.id },
      include: {
        periodoAcademico: true,
        _count: { select: { inscripciones: true, evaluaciones: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ secciones });
  } catch (error) {
    return manejarError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const docente = await requireDocente();
    await requireAsignaturaDelDocente(params.id, docente.id);
    const body = crearSeccionSchema.parse(await req.json());

    const seccion = await prisma.seccion.create({
      data: {
        asignaturaId: params.id,
        periodoAcademicoId: body.periodoAcademicoId,
        nombre: body.nombre,
      },
      include: { periodoAcademico: true },
    });

    return NextResponse.json({ seccion }, { status: 201 });
  } catch (error) {
    return manejarError(error);
  }
}
