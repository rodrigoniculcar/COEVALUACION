import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEstudiante } from "@/lib/session";
import { manejarError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const estudiante = await requireEstudiante();

    const inscripciones = await prisma.inscripcion.findMany({
      where: { estudianteId: estudiante.id },
      include: {
        seccion: {
          include: {
            asignatura: true,
            periodoAcademico: true,
            evaluaciones: { where: { estado: { in: ["ABIERTO", "CERRADO"] } }, orderBy: { createdAt: "desc" } },
          },
        },
      },
    });

    // Para cada evaluación ABIERTA, se calcula cuántos objetivos le faltan
    // al estudiante (autoevaluación + coevaluación de cada compañero de
    // equipo), para poder avisarle cuántas evaluaciones nuevas tiene
    // pendientes sin que tenga que entrar a cada una a revisar.
    const idsAbiertos = inscripciones.flatMap(({ seccion }) =>
      seccion.evaluaciones.filter((e) => e.estado === "ABIERTO").map((e) => e.id)
    );

    const pendientesPorPeriodo = new Map<string, number>();
    if (idsAbiertos.length > 0) {
      const [misGrupos, misEvaluaciones] = await Promise.all([
        prisma.miembroGrupo.findMany({
          where: { estudianteId: estudiante.id, grupo: { periodoId: { in: idsAbiertos } } },
          include: { grupo: { include: { miembros: true } } },
        }),
        prisma.evaluacion.findMany({
          where: { evaluadorId: estudiante.id, periodoId: { in: idsAbiertos } },
          select: { periodoId: true, evaluadoId: true },
        }),
      ]);

      for (const mg of misGrupos) {
        const objetivos = mg.grupo.miembros.map((m) => m.estudianteId);
        const completados = misEvaluaciones.filter(
          (e) => e.periodoId === mg.grupo.periodoId && objetivos.includes(e.evaluadoId)
        ).length;
        pendientesPorPeriodo.set(mg.grupo.periodoId, Math.max(0, objetivos.length - completados));
      }
    }

    const inscripcionesConPendientes = inscripciones.map((insc) => ({
      ...insc,
      seccion: {
        ...insc.seccion,
        evaluaciones: insc.seccion.evaluaciones.map((e) => ({
          ...e,
          pendientes: e.estado === "ABIERTO" ? (pendientesPorPeriodo.get(e.id) ?? 0) : 0,
        })),
      },
    }));

    return NextResponse.json({ inscripciones: inscripcionesConPendientes });
  } catch (error) {
    return manejarError(error);
  }
}
