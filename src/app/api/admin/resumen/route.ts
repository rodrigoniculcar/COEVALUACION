import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdministrador } from "@/lib/session";
import { manejarError } from "@/lib/api-helpers";

// El resumen se filtra a un año-semestre específico (por defecto el marcado
// "actual", o si no hay ninguno, el más reciente): docentes/estudiantes con
// al menos una sección/matrícula en ese periodo, asignaturas con al menos
// una sección en ese periodo, y evaluaciones abiertas dentro de él. Esto
// evita que semestres antiguos infeln los conteos del panel principal.
export async function GET(req: NextRequest) {
  try {
    await requireAdministrador();

    const periodosAcademicos = await prisma.periodoAcademico.findMany({ orderBy: { nombre: "desc" } });

    const idParam = req.nextUrl.searchParams.get("periodoAcademicoId");
    const periodoSeleccionado =
      periodosAcademicos.find((p) => p.id === idParam) ??
      periodosAcademicos.find((p) => p.actual) ??
      periodosAcademicos[0] ??
      null;

    if (!periodoSeleccionado) {
      return NextResponse.json({
        periodosAcademicos: [],
        periodoAcademicoSeleccionadoId: null,
        docentes: 0,
        estudiantes: 0,
        asignaturas: 0,
        periodosAbiertos: 0,
      });
    }

    const filtroSeccion = { periodoAcademicoId: periodoSeleccionado.id };

    const [docentesIds, estudiantesIds, asignaturasIds, periodosAbiertos] = await Promise.all([
      prisma.asignatura.findMany({
        where: { secciones: { some: filtroSeccion } },
        select: { docenteId: true },
        distinct: ["docenteId"],
      }),
      prisma.inscripcion.findMany({
        where: { seccion: filtroSeccion },
        select: { estudianteId: true },
        distinct: ["estudianteId"],
      }),
      prisma.asignatura.findMany({
        where: { secciones: { some: filtroSeccion } },
        select: { id: true },
      }),
      prisma.periodoEvaluacion.count({
        where: { estado: "ABIERTO", seccion: filtroSeccion },
      }),
    ]);

    return NextResponse.json({
      periodosAcademicos,
      periodoAcademicoSeleccionadoId: periodoSeleccionado.id,
      docentes: docentesIds.length,
      estudiantes: estudiantesIds.length,
      asignaturas: asignaturasIds.length,
      periodosAbiertos,
    });
  } catch (error) {
    return manejarError(error);
  }
}
