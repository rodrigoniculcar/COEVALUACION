import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireDocente, ErrorAcceso } from "@/lib/session";
import { manejarError } from "@/lib/api-helpers";

const criterioSchema = z.object({
  nombre: z.string().min(2).max(150),
  descripcion: z.string().max(500).optional(),
  ponderacion: z.number().positive().max(100),
  aplicaAutoevaluacion: z.boolean().default(true),
  aplicaCoevaluacion: z.boolean().default(true),
  aplicaDocente: z.boolean().default(true),
});

const editarRubricaSchema = z.object({
  nombre: z.string().min(2).max(150).optional(),
  descripcion: z.string().max(500).optional(),
  escalaMin: z.number().int().min(0).optional(),
  escalaMax: z.number().int().min(1).optional(),
  criterios: z.array(criterioSchema).min(1).max(30).optional(),
});

// La rúbrica es una biblioteca pública entre docentes: cualquier docente
// (no solo quien la creó) puede editarla y reasignarla a sus propias
// evaluaciones.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireDocente();
    const rubrica = await prisma.rubrica.findUnique({ where: { id: params.id } });
    if (!rubrica) throw new ErrorAcceso("Rúbrica no encontrada", 404);
    const body = editarRubricaSchema.parse(await req.json());

    const escalaMin = body.escalaMin ?? rubrica.escalaMin;
    const escalaMax = body.escalaMax ?? rubrica.escalaMax;
    if (escalaMax <= escalaMin) {
      throw new ErrorAcceso("La escala máxima debe ser mayor que la mínima", 400);
    }

    // Cambiar los criterios o la escala de una rúbrica ya usada en una
    // evaluación abierta o cerrada corrompería el cálculo de notas ya
    // registradas (igual que cambiar la rúbrica de un periodo, ver
    // PATCH /api/periodos/[id]).
    const cambiaCriteriosOEscala =
      body.criterios !== undefined || body.escalaMin !== undefined || body.escalaMax !== undefined;
    if (cambiaCriteriosOEscala) {
      const enUso = await prisma.periodoEvaluacion.findFirst({
        where: { rubricaId: rubrica.id, estado: { not: "BORRADOR" } },
      });
      if (enUso) {
        throw new ErrorAcceso(
          "No puedes modificar los criterios ni la escala de una rúbrica que ya está en uso en una evaluación abierta o cerrada",
          400
        );
      }
    }

    if (body.criterios) {
      const sumaPonderaciones = body.criterios.reduce((acc, c) => acc + c.ponderacion, 0);
      if (Math.abs(sumaPonderaciones - 100) > 0.01) {
        throw new ErrorAcceso(
          `La suma de las ponderaciones de los criterios debe ser 100 (actual: ${sumaPonderaciones})`,
          400
        );
      }
      const sinEvaluador = body.criterios.find(
        (c) => !c.aplicaAutoevaluacion && !c.aplicaCoevaluacion && !c.aplicaDocente
      );
      if (sinEvaluador) {
        throw new ErrorAcceso(
          `El criterio "${sinEvaluador.nombre}" debe aplicar a al menos un tipo de evaluador`,
          400
        );
      }
    }

    const actualizada = await prisma.$transaction(async (tx) => {
      if (body.criterios) {
        await tx.criterioRubrica.deleteMany({ where: { rubricaId: rubrica.id } });
        await tx.criterioRubrica.createMany({
          data: body.criterios.map((c, idx) => ({
            rubricaId: rubrica.id,
            nombre: c.nombre,
            descripcion: c.descripcion,
            ponderacion: c.ponderacion,
            orden: idx,
            aplicaAutoevaluacion: c.aplicaAutoevaluacion,
            aplicaCoevaluacion: c.aplicaCoevaluacion,
            aplicaDocente: c.aplicaDocente,
          })),
        });
      }
      return tx.rubrica.update({
        where: { id: rubrica.id },
        data: {
          nombre: body.nombre,
          descripcion: body.descripcion,
          escalaMin: body.escalaMin,
          escalaMax: body.escalaMax,
        },
        include: { criterios: { orderBy: { orden: "asc" } } },
      });
    });

    return NextResponse.json({ rubrica: actualizada });
  } catch (error) {
    return manejarError(error);
  }
}
