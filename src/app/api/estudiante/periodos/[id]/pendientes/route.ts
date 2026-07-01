import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEstudiante, ErrorAcceso } from "@/lib/session";
import { manejarError } from "@/lib/api-helpers";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const estudiante = await requireEstudiante();

    const periodo = await prisma.periodoEvaluacion.findUnique({
      where: { id: params.id },
      include: {
        rubrica: { include: { criterios: { orderBy: { orden: "asc" } } } },
        curso: {
          include: {
            grupos: {
              where: { miembros: { some: { estudianteId: estudiante.id } } },
              include: { miembros: { include: { estudiante: { select: { id: true, nombre: true } } } } },
            },
          },
        },
      },
    });
    if (!periodo) throw new ErrorAcceso("Periodo no encontrado", 404);

    const grupo = periodo.curso.grupos[0];
    if (!grupo) throw new ErrorAcceso("No perteneces a ningún grupo en este curso", 403);

    const evaluacionesEnviadas = await prisma.evaluacion.findMany({
      where: { periodoId: periodo.id, evaluadorId: estudiante.id },
      include: { detalles: true },
    });

    const objetivos = grupo.miembros.map((m) => ({
      estudianteId: m.estudianteId,
      nombre: m.estudiante.nombre,
      esUnoMismo: m.estudianteId === estudiante.id,
      tipo: (m.estudianteId === estudiante.id ? "AUTOEVALUACION" : "COEVALUACION") as
        | "AUTOEVALUACION"
        | "COEVALUACION",
      completado: evaluacionesEnviadas.some(
        (e) =>
          e.evaluadoId === m.estudianteId &&
          e.tipo === (m.estudianteId === estudiante.id ? "AUTOEVALUACION" : "COEVALUACION")
      ),
    }));

    return NextResponse.json({
      periodo: {
        id: periodo.id,
        nombre: periodo.nombre,
        estado: periodo.estado,
        fechaInicio: periodo.fechaInicio,
        fechaFin: periodo.fechaFin,
      },
      rubrica: periodo.rubrica,
      grupoId: grupo.id,
      grupoNombre: grupo.nombre,
      objetivos,
    });
  } catch (error) {
    return manejarError(error);
  }
}
