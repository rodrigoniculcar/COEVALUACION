import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdministrador, ErrorAcceso } from "@/lib/session";
import { manejarError } from "@/lib/api-helpers";
import type { CriterioResultado } from "@/lib/grading";

// Reporte de un estudiante visto por el administrador: sus datos y todos
// sus resultados ya calculados (evaluaciones cerradas), mirror de
// GET /api/estudiante/resultados pero para un estudianteId arbitrario.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdministrador();

    const usuario = await prisma.user.findUnique({ where: { id: params.id } });
    if (!usuario || usuario.rol !== "ESTUDIANTE") throw new ErrorAcceso("Estudiante no encontrado", 404);

    const estudiante = {
      id: usuario.id,
      rut: usuario.rut,
      nombre: usuario.nombre,
      email: usuario.email,
      activo: usuario.activo,
      createdAt: usuario.createdAt,
    };

    const resultados = await prisma.resultado.findMany({
      where: { estudianteId: params.id, periodo: { estado: "CERRADO" } },
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

    return NextResponse.json({ estudiante, resultados: datos });
  } catch (error) {
    return manejarError(error);
  }
}
