import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireDocente, ErrorAcceso } from "@/lib/session";
import { requireCursoDelDocente } from "@/lib/cursos";
import { manejarError } from "@/lib/api-helpers";

const criterioSchema = z.object({
  nombre: z.string().min(2).max(150),
  descripcion: z.string().max(500).optional(),
  ponderacion: z.number().positive().max(100),
  aplicaAutoevaluacion: z.boolean().default(true),
  aplicaCoevaluacion: z.boolean().default(true),
  aplicaDocente: z.boolean().default(true),
});

const crearRubricaSchema = z.object({
  nombre: z.string().min(2).max(150),
  descripcion: z.string().max(500).optional(),
  escalaMin: z.number().int().min(0).default(1),
  escalaMax: z.number().int().min(1).default(5),
  criterios: z.array(criterioSchema).min(1).max(30),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const docente = await requireDocente();
    await requireCursoDelDocente(params.id, docente.id);

    const rubricas = await prisma.rubrica.findMany({
      where: { cursoId: params.id },
      include: { criterios: { orderBy: { orden: "asc" } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ rubricas });
  } catch (error) {
    return manejarError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const docente = await requireDocente();
    await requireCursoDelDocente(params.id, docente.id);
    const body = crearRubricaSchema.parse(await req.json());

    if (body.escalaMax <= body.escalaMin) {
      throw new ErrorAcceso("La escala máxima debe ser mayor que la mínima", 400);
    }

    const sumaPonderaciones = body.criterios.reduce((acc, c) => acc + c.ponderacion, 0);
    if (Math.abs(sumaPonderaciones - 100) > 0.01) {
      throw new ErrorAcceso(
        `La suma de las ponderaciones de los criterios debe ser 100 (actual: ${sumaPonderaciones})`,
        400
      );
    }

    const criterioSinEvaluador = body.criterios.find(
      (c) => !c.aplicaAutoevaluacion && !c.aplicaCoevaluacion && !c.aplicaDocente
    );
    if (criterioSinEvaluador) {
      throw new ErrorAcceso(
        `El criterio "${criterioSinEvaluador.nombre}" debe aplicar a al menos un tipo de evaluador`,
        400
      );
    }

    const rubrica = await prisma.rubrica.create({
      data: {
        cursoId: params.id,
        nombre: body.nombre,
        descripcion: body.descripcion,
        escalaMin: body.escalaMin,
        escalaMax: body.escalaMax,
        criterios: {
          create: body.criterios.map((c, idx) => ({
            nombre: c.nombre,
            descripcion: c.descripcion,
            ponderacion: c.ponderacion,
            orden: idx,
            aplicaAutoevaluacion: c.aplicaAutoevaluacion,
            aplicaCoevaluacion: c.aplicaCoevaluacion,
            aplicaDocente: c.aplicaDocente,
          })),
        },
      },
      include: { criterios: true },
    });

    return NextResponse.json({ rubrica }, { status: 201 });
  } catch (error) {
    return manejarError(error);
  }
}
