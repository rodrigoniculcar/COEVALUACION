import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireDocente } from "@/lib/session";
import { manejarError } from "@/lib/api-helpers";

const crearPeriodoAcademicoSchema = z.object({
  nombre: z.string().min(2).max(30),
});

// Catálogo compartido de años-semestre (ej. "2026-1"): cualquier docente
// puede verlo y crear uno nuevo si no existe, para evitar duplicados o
// variantes de escritura del mismo periodo entre distintos docentes.
export async function GET() {
  try {
    await requireDocente();

    const periodosAcademicos = await prisma.periodoAcademico.findMany({
      orderBy: { nombre: "desc" },
    });

    return NextResponse.json({ periodosAcademicos });
  } catch (error) {
    return manejarError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireDocente();
    const body = crearPeriodoAcademicoSchema.parse(await req.json());
    const nombre = body.nombre.trim();

    const periodoAcademico = await prisma.periodoAcademico.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });

    return NextResponse.json({ periodoAcademico }, { status: 201 });
  } catch (error) {
    return manejarError(error);
  }
}
