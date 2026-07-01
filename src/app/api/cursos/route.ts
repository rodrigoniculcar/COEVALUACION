import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireDocente, requireUsuario } from "@/lib/session";
import { manejarError } from "@/lib/api-helpers";

const crearCursoSchema = z.object({
  nombre: z.string().min(3).max(120),
  codigo: z.string().min(2).max(30),
});

export async function GET() {
  try {
    const usuario = await requireUsuario();

    if (usuario.rol === "DOCENTE") {
      const cursos = await prisma.curso.findMany({
        where: { docenteId: usuario.id },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { inscripciones: true, grupos: true, periodos: true } } },
      });
      return NextResponse.json({ cursos });
    }

    const cursos = await prisma.curso.findMany({
      where: { inscripciones: { some: { estudianteId: usuario.id } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ cursos });
  } catch (error) {
    return manejarError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const docente = await requireDocente();
    const body = crearCursoSchema.parse(await req.json());

    const curso = await prisma.curso.create({
      data: {
        nombre: body.nombre,
        codigo: body.codigo.toUpperCase().trim(),
        docenteId: docente.id,
      },
    });

    return NextResponse.json({ curso }, { status: 201 });
  } catch (error) {
    return manejarError(error);
  }
}
