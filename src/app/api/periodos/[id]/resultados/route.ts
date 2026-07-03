import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDocente, ErrorAcceso } from "@/lib/session";
import { recalcularResultadosPeriodo } from "@/lib/resultados";
import { manejarError } from "@/lib/api-helpers";
import type { CriterioResultado } from "@/lib/grading";

function promedioIndicadores(listas: CriterioResultado[][]) {
  const acumulado = new Map<string, { nombre: string; suma: number; n: number }>();
  for (const lista of listas) {
    for (const c of lista) {
      const actual = acumulado.get(c.criterioId) ?? { nombre: c.nombre, suma: 0, n: 0 };
      actual.suma += c.promedio;
      actual.n += 1;
      acumulado.set(c.criterioId, actual);
    }
  }
  return Array.from(acumulado.entries())
    .map(([criterioId, v]) => ({ criterioId, nombre: v.nombre, promedio: v.suma / v.n }))
    .sort((a, b) => a.promedio - b.promedio);
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const docente = await requireDocente();

    const periodo = await prisma.periodoEvaluacion.findUnique({
      where: { id: params.id },
      include: { curso: true },
    });
    if (!periodo) throw new ErrorAcceso("Periodo no encontrado", 404);
    if (periodo.curso.docenteId !== docente.id) throw new ErrorAcceso("No tienes acceso a este periodo", 403);

    await recalcularResultadosPeriodo(periodo.id);

    const resultados = await prisma.resultado.findMany({
      where: { periodoId: periodo.id },
      include: {
        estudiante: { select: { id: true, nombre: true, email: true } },
      },
    });

    // grupoNombre/integrantesHistoricos vienen congelados en el propio
    // Resultado (no de un join en vivo a Grupo), para que el reporte no
    // cambie si el equipo se reorganiza después.
    const individuos = resultados.map((r) => ({
      estudianteId: r.estudianteId,
      nombre: r.estudiante.nombre,
      email: r.estudiante.email,
      grupoId: r.grupoId,
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

    const porGrupo = new Map<string, typeof individuos>();
    for (const ind of individuos) {
      const lista = porGrupo.get(ind.grupoId) ?? [];
      lista.push(ind);
      porGrupo.set(ind.grupoId, lista);
    }

    const equipos = Array.from(porGrupo.entries()).map(([grupoId, integrantes]) => ({
      grupoId,
      nombre: integrantes[0]?.grupoNombre ?? "",
      integrantes: integrantes.length,
      notaPromedio:
        integrantes.reduce((acc, i) => acc + i.notaFinal, 0) / (integrantes.length || 1),
      notaEscala1a7Promedio:
        integrantes.reduce((acc, i) => acc + i.notaEscala1a7, 0) / (integrantes.length || 1),
      indicadoresMasBajos: promedioIndicadores(integrantes.map((i) => i.detalleCriterios)).slice(0, 3),
    }));

    const resumenCurso = {
      totalEstudiantes: individuos.length,
      notaPromedio:
        individuos.length > 0
          ? individuos.reduce((acc, i) => acc + i.notaFinal, 0) / individuos.length
          : 0,
      notaEscala1a7Promedio:
        individuos.length > 0
          ? individuos.reduce((acc, i) => acc + i.notaEscala1a7, 0) / individuos.length
          : 0,
      indicadoresMasBajos: promedioIndicadores(individuos.map((i) => i.detalleCriterios)).slice(0, 5),
    };

    return NextResponse.json({ periodo, resumenCurso, equipos, individuos });
  } catch (error) {
    return manejarError(error);
  }
}
