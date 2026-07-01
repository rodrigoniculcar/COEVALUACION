import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireDocente, ErrorAcceso } from "@/lib/session";
import { requireCursoDelDocente } from "@/lib/cursos";
import { manejarError } from "@/lib/api-helpers";

const crearPeriodoSchema = z.object({
  nombre: z.string().min(2).max(150),
  rubricaId: z.string(),
  fechaInicio: z.string().datetime(),
  fechaFin: z.string().datetime(),
  pesoAutoevaluacion: z.number().min(0).max(100),
  pesoCoevaluacion: z.number().min(0).max(100),
  pesoDocente: z.number().min(0).max(100),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const docente = await requireDocente();
    await requireCursoDelDocente(params.id, docente.id);

    const periodos = await prisma.periodoEvaluacion.findMany({
      where: { cursoId: params.id },
      include: { rubrica: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ periodos });
  } catch (error) {
    return manejarError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const docente = await requireDocente();
    await requireCursoDelDocente(params.id, docente.id);
    const body = crearPeriodoSchema.parse(await req.json());

    const sumaPesos = body.pesoAutoevaluacion + body.pesoCoevaluacion + body.pesoDocente;
    if (Math.abs(sumaPesos - 100) > 0.01) {
      throw new ErrorAcceso(
        `Los pesos de autoevaluación, coevaluación y docente deben sumar 100 (actual: ${sumaPesos})`,
        400
      );
    }

    const rubrica = await prisma.rubrica.findUnique({ where: { id: body.rubricaId } });
    if (!rubrica || rubrica.cursoId !== params.id) {
      throw new ErrorAcceso("La rúbrica indicada no pertenece a este curso", 400);
    }

    const fechaInicio = new Date(body.fechaInicio);
    const fechaFin = new Date(body.fechaFin);
    if (fechaFin <= fechaInicio) {
      throw new ErrorAcceso("La fecha de fin debe ser posterior a la de inicio", 400);
    }

    const periodo = await prisma.periodoEvaluacion.create({
      data: {
        cursoId: params.id,
        rubricaId: body.rubricaId,
        nombre: body.nombre,
        fechaInicio,
        fechaFin,
        pesoAutoevaluacion: body.pesoAutoevaluacion,
        pesoCoevaluacion: body.pesoCoevaluacion,
        pesoDocente: body.pesoDocente,
        estado: "BORRADOR",
      },
    });

    return NextResponse.json({ periodo }, { status: 201 });
  } catch (error) {
    return manejarError(error);
  }
}
