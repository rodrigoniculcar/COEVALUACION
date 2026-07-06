import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDocente } from "@/lib/session";
import { manejarError } from "@/lib/api-helpers";

// Lista liviana de docentes (id/nombre/correo), usada para elegir a un
// colega como coevaluador de una evaluación. No incluye al propio docente
// autenticado (no tiene sentido agregarse a sí mismo como coevaluador, ya
// que es el titular).
export async function GET() {
  try {
    const docente = await requireDocente();

    const docentes = await prisma.user.findMany({
      where: { rol: "DOCENTE", activo: true, id: { not: docente.id } },
      select: { id: true, nombre: true, email: true },
      orderBy: { nombre: "asc" },
    });

    return NextResponse.json({ docentes });
  } catch (error) {
    return manejarError(error);
  }
}
