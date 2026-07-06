import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEstudiante } from "@/lib/session";
import { manejarError } from "@/lib/api-helpers";
import type { CriterioResultado } from "@/lib/grading";

export async function GET() {
  try {
    const estudiante = await requireEstudiante();

    // Solo se muestran resultados de periodos ya CERRADOS: mientras el
    // periodo está abierto, exponer notas parciales podría sesgar la
    // coevaluación entre compañeros.
    const resultados = await prisma.resultado.findMany({
      where: { estudianteId: estudiante.id, periodo: { estado: "CERRADO" } },
      include: {
        periodo: { include: { seccion: { include: { asignatura: true, periodoAcademico: true } } } },
      },
      orderBy: { calculadoAt: "desc" },
    });

    const datos = resultados.map((r) => ({
      periodoId: r.periodoId,
      periodoNombre: r.periodo.nombre,
      asignaturaId: r.periodo.seccion.asignatura.id,
      asignaturaNombre: r.periodo.seccion.asignatura.nombre,
      seccionId: r.periodo.seccion.id,
      seccionNombre: r.periodo.seccion.nombre,
      periodoAcademicoNombre: r.periodo.seccion.periodoAcademico.nombre,
      periodoAcademicoActual: r.periodo.seccion.periodoAcademico.actual,
      estadoPeriodo: r.periodo.estado,
      grupoNombre: r.grupoNombre,
      integrantesHistoricos: r.integrantesHistoricos as unknown as string[],
      notaAutoevaluacion: r.notaAutoevaluacion,
      notaCoevaluacion: r.notaCoevaluacion,
      notaDocente: r.notaDocente,
      notaFinal: r.notaFinal,
      notaEscala1a7: r.notaEscala1a7,
      retroalimentacion: r.retroalimentacion,
      detalleCriterios: r.detalleCriterios as unknown as CriterioResultado[],
    }));

    return NextResponse.json({ resultados: datos });
  } catch (error) {
    return manejarError(error);
  }
}
