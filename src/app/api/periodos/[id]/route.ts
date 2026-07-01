import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireDocente, ErrorAcceso } from "@/lib/session";
import { recalcularResultadosPeriodo } from "@/lib/resultados";
import { manejarError } from "@/lib/api-helpers";

const actualizarEstadoSchema = z.object({
  estado: z.enum(["BORRADOR", "ABIERTO", "CERRADO"]),
});

async function requirePeriodoDelDocente(periodoId: string, docenteId: string) {
  const periodo = await prisma.periodoEvaluacion.findUnique({
    where: { id: periodoId },
    include: { curso: true },
  });
  if (!periodo) throw new ErrorAcceso("Periodo no encontrado", 404);
  if (periodo.curso.docenteId !== docenteId) throw new ErrorAcceso("No tienes acceso a este periodo", 403);
  return periodo;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const docente = await requireDocente();
    const periodo = await requirePeriodoDelDocente(params.id, docente.id);
    const detalle = await prisma.periodoEvaluacion.findUnique({
      where: { id: periodo.id },
      include: { rubrica: { include: { criterios: true } }, curso: true },
    });
    return NextResponse.json({ periodo: detalle });
  } catch (error) {
    return manejarError(error);
  }
}

// Transiciona el estado del periodo. Al pasar a CERRADO se recalculan y
// publican los resultados finales de todos los estudiantes del curso.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const docente = await requireDocente();
    const periodo = await requirePeriodoDelDocente(params.id, docente.id);
    const body = actualizarEstadoSchema.parse(await req.json());

    const actualizado = await prisma.periodoEvaluacion.update({
      where: { id: periodo.id },
      data: { estado: body.estado },
    });

    if (body.estado === "CERRADO") {
      await recalcularResultadosPeriodo(periodo.id);
    }

    return NextResponse.json({ periodo: actualizado });
  } catch (error) {
    return manejarError(error);
  }
}
