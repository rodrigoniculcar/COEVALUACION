import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEstudiante } from "@/lib/session";
import { manejarError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const estudiante = await requireEstudiante();

    const inscripciones = await prisma.inscripcion.findMany({
      where: { estudianteId: estudiante.id },
      include: {
        curso: {
          include: {
            periodos: { where: { estado: { in: ["ABIERTO", "CERRADO"] } }, orderBy: { createdAt: "desc" } },
            grupos: { where: { miembros: { some: { estudianteId: estudiante.id } } } },
          },
        },
      },
    });

    return NextResponse.json({ inscripciones });
  } catch (error) {
    return manejarError(error);
  }
}
