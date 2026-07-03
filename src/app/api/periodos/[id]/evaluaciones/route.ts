import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUsuario, ErrorAcceso } from "@/lib/session";
import { recalcularResultadosPeriodo } from "@/lib/resultados";
import { manejarError } from "@/lib/api-helpers";

const detalleSchema = z.object({
  criterioId: z.string(),
  puntaje: z.number(),
});

const enviarEvaluacionSchema = z.object({
  tipo: z.enum(["AUTOEVALUACION", "COEVALUACION", "DOCENTE"]),
  evaluadoId: z.string(),
  grupoId: z.string(),
  comentario: z.string().max(1000).optional(),
  detalles: z.array(detalleSchema).min(1),
});

// Cada criterio puede estar restringido a solo algunos tipos de evaluador
// (ver CriterioRubrica.aplicaX); un formulario de un tipo dado solo debe
// mostrar/exigir los criterios aplicables a ese tipo.
function criteriosAplicables<T extends { aplicaAutoevaluacion: boolean; aplicaCoevaluacion: boolean; aplicaDocente: boolean }>(
  criterios: T[],
  tipo: "AUTOEVALUACION" | "COEVALUACION" | "DOCENTE"
): T[] {
  return criterios.filter((c) => {
    if (tipo === "AUTOEVALUACION") return c.aplicaAutoevaluacion;
    if (tipo === "COEVALUACION") return c.aplicaCoevaluacion;
    return c.aplicaDocente;
  });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const usuario = await requireUsuario();

    const evaluaciones = await prisma.evaluacion.findMany({
      where: {
        periodoId: params.id,
        ...(usuario.rol === "ESTUDIANTE" ? { evaluadorId: usuario.id } : {}),
      },
      include: { detalles: true },
    });

    return NextResponse.json({ evaluaciones });
  } catch (error) {
    return manejarError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const usuario = await requireUsuario();
    const body = enviarEvaluacionSchema.parse(await req.json());

    const periodo = await prisma.periodoEvaluacion.findUnique({
      where: { id: params.id },
      include: { curso: true, rubrica: { include: { criterios: true } } },
    });
    if (!periodo) throw new ErrorAcceso("Periodo no encontrado", 404);
    if (periodo.estado !== "ABIERTO") {
      throw new ErrorAcceso("El periodo de evaluación no está abierto", 400);
    }

    const grupo = await prisma.grupo.findUnique({
      where: { id: body.grupoId },
      include: { miembros: true },
    });
    if (!grupo || grupo.periodoId !== periodo.id) {
      throw new ErrorAcceso("El equipo indicado no pertenece a este periodo", 400);
    }
    const idsGrupo = grupo.miembros.map((m) => m.estudianteId);

    if (usuario.rol === "ESTUDIANTE") {
      if (body.tipo === "DOCENTE") throw new ErrorAcceso("Un estudiante no puede registrar evaluación docente", 403);
      if (!idsGrupo.includes(usuario.id)) throw new ErrorAcceso("No perteneces a este grupo", 403);
      if (body.tipo === "AUTOEVALUACION" && body.evaluadoId !== usuario.id) {
        throw new ErrorAcceso("La autoevaluación debe referirse a ti mismo", 400);
      }
      if (body.tipo === "COEVALUACION") {
        if (body.evaluadoId === usuario.id) throw new ErrorAcceso("La coevaluación no puede ser sobre ti mismo", 400);
        if (!idsGrupo.includes(body.evaluadoId)) throw new ErrorAcceso("Solo puedes coevaluar a compañeros de tu grupo", 400);
      }
    } else {
      // DOCENTE
      if (body.tipo !== "DOCENTE") throw new ErrorAcceso("El docente solo registra evaluaciones de tipo DOCENTE", 400);
      if (periodo.curso.docenteId !== usuario.id) throw new ErrorAcceso("No tienes acceso a este periodo", 403);
      if (!idsGrupo.includes(body.evaluadoId)) throw new ErrorAcceso("El estudiante no pertenece a ese grupo", 400);
    }

    const aplicables = criteriosAplicables(periodo.rubrica.criterios, body.tipo);
    const criterioIds = new Set(aplicables.map((c) => c.id));
    if (body.detalles.some((d) => !criterioIds.has(d.criterioId))) {
      throw new ErrorAcceso("Uno de los criterios no aplica a este tipo de evaluación", 400);
    }
    if (body.detalles.length !== aplicables.length) {
      throw new ErrorAcceso("Debes calificar todos los criterios aplicables de la rúbrica", 400);
    }
    for (const d of body.detalles) {
      if (d.puntaje < periodo.rubrica.escalaMin || d.puntaje > periodo.rubrica.escalaMax) {
        throw new ErrorAcceso(
          `El puntaje debe estar entre ${periodo.rubrica.escalaMin} y ${periodo.rubrica.escalaMax}`,
          400
        );
      }
    }

    const evaluacionExistente = await prisma.evaluacion.findUnique({
      where: {
        periodoId_tipo_evaluadorId_evaluadoId: {
          periodoId: periodo.id,
          tipo: body.tipo,
          evaluadorId: usuario.id,
          evaluadoId: body.evaluadoId,
        },
      },
    });

    const evaluacion = await prisma.$transaction(async (tx) => {
      if (evaluacionExistente) {
        await tx.detalleEvaluacion.deleteMany({ where: { evaluacionId: evaluacionExistente.id } });
        return tx.evaluacion.update({
          where: { id: evaluacionExistente.id },
          data: {
            comentario: body.comentario,
            detalles: { create: body.detalles },
          },
          include: { detalles: true },
        });
      }
      return tx.evaluacion.create({
        data: {
          periodoId: periodo.id,
          tipo: body.tipo,
          evaluadorId: usuario.id,
          evaluadoId: body.evaluadoId,
          grupoId: body.grupoId,
          comentario: body.comentario,
          detalles: { create: body.detalles },
        },
        include: { detalles: true },
      });
    });

    await recalcularResultadosPeriodo(periodo.id);

    return NextResponse.json({ evaluacion }, { status: 201 });
  } catch (error) {
    return manejarError(error);
  }
}
