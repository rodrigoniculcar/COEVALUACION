import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireDocente } from "@/lib/session";
import { manejarError } from "@/lib/api-helpers";

const crearAsignaturaSchema = z.object({
  nombre: z.string().min(3).max(120),
  codigo: z.string().min(2).max(30),
});

// Un docente puede tener muchas asignaturas; cada una agrupa sus secciones
// (una por cada año-semestre en que se dicta).
export async function GET() {
  try {
    const docente = await requireDocente();

    const asignaturas = await prisma.asignatura.findMany({
      where: { docenteId: docente.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { secciones: true } } },
    });

    return NextResponse.json({ asignaturas });
  } catch (error) {
    return manejarError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const docente = await requireDocente();
    const body = crearAsignaturaSchema.parse(await req.json());

    const asignatura = await prisma.asignatura.create({
      data: {
        nombre: body.nombre,
        codigo: body.codigo.toUpperCase().trim(),
        docenteId: docente.id,
      },
    });

    return NextResponse.json({ asignatura }, { status: 201 });
  } catch (error) {
    return manejarError(error);
  }
}
