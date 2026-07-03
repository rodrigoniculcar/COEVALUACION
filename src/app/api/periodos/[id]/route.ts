import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireDocente, ErrorAcceso } from "@/lib/session";
import { requirePeriodoDelDocente } from "@/lib/cursos";
import { recalcularResultadosPeriodo } from "@/lib/resultados";
import { manejarError } from "@/lib/api-helpers";

const actualizarPeriodoSchema = z.object({
  estado: z.enum(["BORRADOR", "ABIERTO", "CERRADO"]).optional(),
  nombre: z.string().min(2).max(150).optional(),
  rubricaId: z.string().optional(),
  fechaInicio: z.string().datetime().optional(),
  fechaFin: z.string().datetime().optional(),
  pesoAutoevaluacion: z.number().min(0).max(100).optional(),
  pesoCoevaluacion: z.number().min(0).max(100).optional(),
  pesoDocente: z.number().min(0).max(100).optional(),
  escalaExigencia: z.number().int().min(1).max(99).optional(),
});

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

// Edita el periodo (nombre, fechas, rúbrica, pesos, exigencia) y/o
// transiciona su estado. Al pasar a CERRADO se recalculan y publican los
// resultados finales de todos los estudiantes del curso.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const docente = await requireDocente();
    const periodo = await requirePeriodoDelDocente(params.id, docente.id);
    const body = actualizarPeriodoSchema.parse(await req.json());

    // Cambiar la rúbrica después de BORRADOR podría dejar evaluaciones ya
    // registradas apuntando a criterios que ya no existen en la rúbrica
    // nueva, corrompiendo el cálculo de notas. Las fechas, pesos y nombre
    // sí se pueden ajustar en cualquier momento.
    if (body.rubricaId && body.rubricaId !== periodo.rubricaId && periodo.estado !== "BORRADOR") {
      throw new ErrorAcceso(
        "Solo puedes cambiar la rúbrica mientras el periodo está en Borrador (ya hay evaluaciones que dependen de la rúbrica actual)",
        400
      );
    }

    if (body.rubricaId) {
      const rubrica = await prisma.rubrica.findUnique({ where: { id: body.rubricaId } });
      if (!rubrica || rubrica.cursoId !== periodo.cursoId) {
        throw new ErrorAcceso("La rúbrica indicada no pertenece a este curso", 400);
      }
    }

    const pesoAutoevaluacion = body.pesoAutoevaluacion ?? periodo.pesoAutoevaluacion;
    const pesoCoevaluacion = body.pesoCoevaluacion ?? periodo.pesoCoevaluacion;
    const pesoDocente = body.pesoDocente ?? periodo.pesoDocente;
    if (
      (body.pesoAutoevaluacion !== undefined ||
        body.pesoCoevaluacion !== undefined ||
        body.pesoDocente !== undefined) &&
      Math.abs(pesoAutoevaluacion + pesoCoevaluacion + pesoDocente - 100) > 0.01
    ) {
      throw new ErrorAcceso("Los pesos de autoevaluación, coevaluación y docente deben sumar 100", 400);
    }

    const fechaInicio = body.fechaInicio ? new Date(body.fechaInicio) : periodo.fechaInicio;
    const fechaFin = body.fechaFin ? new Date(body.fechaFin) : periodo.fechaFin;
    if ((body.fechaInicio || body.fechaFin) && fechaFin <= fechaInicio) {
      throw new ErrorAcceso("La fecha de fin debe ser posterior a la de inicio", 400);
    }

    const actualizado = await prisma.periodoEvaluacion.update({
      where: { id: periodo.id },
      data: {
        estado: body.estado,
        nombre: body.nombre,
        rubricaId: body.rubricaId,
        fechaInicio: body.fechaInicio ? fechaInicio : undefined,
        fechaFin: body.fechaFin ? fechaFin : undefined,
        pesoAutoevaluacion: body.pesoAutoevaluacion,
        pesoCoevaluacion: body.pesoCoevaluacion,
        pesoDocente: body.pesoDocente,
        escalaExigencia: body.escalaExigencia,
      },
      include: { rubrica: true },
    });

    // Cualquier cambio (pesos, exigencia, o el cierre) puede afectar la nota
    // ya calculada, así que se recalcula salvo que solo se haya cambiado el
    // nombre o las fechas (que no afectan el cálculo).
    const afectaCalculo =
      body.estado === "CERRADO" ||
      body.pesoAutoevaluacion !== undefined ||
      body.pesoCoevaluacion !== undefined ||
      body.pesoDocente !== undefined ||
      body.escalaExigencia !== undefined;
    if (afectaCalculo) {
      await recalcularResultadosPeriodo(periodo.id);
    }

    return NextResponse.json({ periodo: actualizado });
  } catch (error) {
    return manejarError(error);
  }
}
