import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireDocente, ErrorAcceso } from "@/lib/session";
import { requirePeriodoDelDocente } from "@/lib/academico";
import { manejarError } from "@/lib/api-helpers";

const agregarCoevaluadorSchema = z.object({
  email: z.string().email(),
});

// Un docente titular puede agregar a otro docente ya existente en el
// sistema como coevaluador de una evaluación específica: ese coevaluador
// podrá registrar evaluaciones de tipo DOCENTE para los estudiantes de este
// periodo, y su nota se promedia junto con la del titular (ver
// calcularResultadoEstudiante en src/lib/grading.ts).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const docente = await requireDocente();
    await requirePeriodoDelDocente(params.id, docente.id);

    const coevaluadores = await prisma.docenteEvaluador.findMany({
      where: { periodoId: params.id },
      include: { docente: { select: { id: true, nombre: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ coevaluadores });
  } catch (error) {
    return manejarError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const docente = await requireDocente();
    const periodo = await requirePeriodoDelDocente(params.id, docente.id);
    const body = agregarCoevaluadorSchema.parse(await req.json());

    const email = body.email.toLowerCase().trim();
    const otroDocente = await prisma.user.findUnique({ where: { email } });
    if (!otroDocente || otroDocente.rol !== "DOCENTE") {
      throw new ErrorAcceso("No existe una cuenta docente con ese correo", 404);
    }
    if (otroDocente.id === docente.id) {
      throw new ErrorAcceso("Ya eres el docente titular de esta evaluación", 400);
    }

    const coevaluador = await prisma.docenteEvaluador.upsert({
      where: { periodoId_docenteId: { periodoId: periodo.id, docenteId: otroDocente.id } },
      update: {},
      create: { periodoId: periodo.id, docenteId: otroDocente.id },
      include: { docente: { select: { id: true, nombre: true, email: true } } },
    });

    return NextResponse.json({ coevaluador }, { status: 201 });
  } catch (error) {
    return manejarError(error);
  }
}
