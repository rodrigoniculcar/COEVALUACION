import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdministrador } from "@/lib/session";
import { manejarError } from "@/lib/api-helpers";

export async function GET() {
  try {
    await requireAdministrador();

    const [docentes, estudiantes, cursos, periodosAbiertos] = await Promise.all([
      prisma.user.count({ where: { rol: "DOCENTE" } }),
      prisma.user.count({ where: { rol: "ESTUDIANTE" } }),
      prisma.curso.count(),
      prisma.periodoEvaluacion.count({ where: { estado: "ABIERTO" } }),
    ]);

    return NextResponse.json({ docentes, estudiantes, cursos, periodosAbiertos });
  } catch (error) {
    return manejarError(error);
  }
}
