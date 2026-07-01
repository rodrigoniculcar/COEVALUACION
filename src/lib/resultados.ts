import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calcularResultadoEstudiante, type EvaluacionInput } from "@/lib/grading";

/**
 * Recalcula y persiste (upsert) el Resultado de cada estudiante inscrito en
 * un periodo de evaluación, a partir de todas las Evaluacion registradas
 * hasta el momento. Se puede llamar tanto para una vista previa en vivo
 * (periodo ABIERTO) como al cerrar el periodo.
 */
export async function recalcularResultadosPeriodo(periodoId: string) {
  const periodo = await prisma.periodoEvaluacion.findUniqueOrThrow({
    where: { id: periodoId },
    include: {
      rubrica: { include: { criterios: true } },
      curso: {
        include: {
          grupos: { include: { miembros: { include: { estudiante: true } } } },
        },
      },
    },
  });

  const evaluaciones = await prisma.evaluacion.findMany({
    where: { periodoId },
    include: { detalles: true },
  });

  const criterios = periodo.rubrica.criterios.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    ponderacion: c.ponderacion,
  }));

  const toInput = (e: (typeof evaluaciones)[number]): EvaluacionInput => ({
    tipo: e.tipo,
    evaluadorId: e.evaluadorId,
    detalles: e.detalles.map((d) => ({ criterioId: d.criterioId, puntaje: d.puntaje })),
  });

  const resultados = [];

  for (const grupo of periodo.curso.grupos) {
    for (const miembro of grupo.miembros) {
      const estudianteId = miembro.estudianteId;
      const evaluacionesDelEstudiante = evaluaciones.filter((e) => e.evaluadoId === estudianteId);

      const autoevaluacion =
        evaluacionesDelEstudiante.find((e) => e.tipo === "AUTOEVALUACION") ?? null;
      const coevaluaciones = evaluacionesDelEstudiante.filter((e) => e.tipo === "COEVALUACION");
      const docente = evaluacionesDelEstudiante.find((e) => e.tipo === "DOCENTE") ?? null;

      const calculo = calcularResultadoEstudiante({
        autoevaluacion: autoevaluacion ? toInput(autoevaluacion) : null,
        coevaluaciones: coevaluaciones.map(toInput),
        docente: docente ? toInput(docente) : null,
        criterios,
        escalaMin: periodo.rubrica.escalaMin,
        escalaMax: periodo.rubrica.escalaMax,
        pesos: {
          pesoAutoevaluacion: periodo.pesoAutoevaluacion,
          pesoCoevaluacion: periodo.pesoCoevaluacion,
          pesoDocente: periodo.pesoDocente,
        },
      });

      const resultado = await prisma.resultado.upsert({
        where: { periodoId_estudianteId: { periodoId, estudianteId } },
        create: {
          periodoId,
          estudianteId,
          grupoId: grupo.id,
          notaAutoevaluacion: calculo.notaAutoevaluacion,
          notaCoevaluacion: calculo.notaCoevaluacion,
          notaDocente: calculo.notaDocente,
          notaFinal: calculo.notaFinal,
          detalleCriterios: calculo.detalleCriterios as unknown as Prisma.InputJsonValue,
          retroalimentacion: calculo.retroalimentacion,
        },
        update: {
          grupoId: grupo.id,
          notaAutoevaluacion: calculo.notaAutoevaluacion,
          notaCoevaluacion: calculo.notaCoevaluacion,
          notaDocente: calculo.notaDocente,
          notaFinal: calculo.notaFinal,
          detalleCriterios: calculo.detalleCriterios as unknown as Prisma.InputJsonValue,
          retroalimentacion: calculo.retroalimentacion,
          calculadoAt: new Date(),
        },
      });
      resultados.push(resultado);
    }
  }

  return resultados;
}
