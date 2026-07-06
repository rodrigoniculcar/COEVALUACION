import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireDocente, ErrorAcceso } from "@/lib/session";
import { requirePeriodoDelDocente, requireAccesoEvaluacionDocente } from "@/lib/academico";
import { manejarError } from "@/lib/api-helpers";

const crearGrupoSchema = z.object({
  nombre: z.string().min(1).max(80),
  estudianteIds: z.array(z.string()).min(1).max(50),
});

// Los equipos pertenecen a un periodo específico (no a la sección en general):
// la conformación de equipos puede cambiar de una evaluación a otra. Un
// coevaluador agregado a esta evaluación también necesita ver los equipos
// para poder calificar (aunque no pueda crearlos/editarlos).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const docente = await requireDocente();
    await requireAccesoEvaluacionDocente(params.id, docente.id);

    const grupos = await prisma.grupo.findMany({
      where: { periodoId: params.id },
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
    const periodo = await requirePeriodoDelDocente(params.id, docente.id);
    const body = crearGrupoSchema.parse(await req.json());

    const inscritos = await prisma.inscripcion.findMany({
      where: { seccionId: periodo.seccionId, estudianteId: { in: body.estudianteIds } },
    });
    if (inscritos.length !== body.estudianteIds.length) {
      throw new ErrorAcceso("Uno o más estudiantes no están inscritos en esta sección", 400);
    }

    const grupo = await prisma.grupo.create({
      data: {
        periodoId: params.id,
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
