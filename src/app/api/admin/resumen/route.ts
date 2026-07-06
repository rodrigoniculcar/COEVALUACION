import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdministrador } from "@/lib/session";
import { manejarError } from "@/lib/api-helpers";

export async function GET() {
  try {
    await requireAdministrador();

    const [docentes, estudiantes, asignaturas, periodosAbiertos] = await Promise.all([
      prisma.user.count({ where: { rol: "DOCENTE" } }),
      prisma.user.count({ where: { rol: "ESTUDIANTE" } }),
      prisma.asignatura.count(),
      prisma.periodoEvaluacion.count({ where: { estado: "ABIERTO" } }),
    ]);

    return NextResponse.json({ docentes, estudiantes, asignaturas, periodosAbiertos });
  } catch (error) {
    return manejarError(error);
  }
}
