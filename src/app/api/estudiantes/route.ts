import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDocente } from "@/lib/session";
import { manejarError } from "@/lib/api-helpers";

// Búsqueda de estudiantes YA EXISTENTES en el sistema (sin importar en qué
// sección estén, o si no están en ninguna), para que un docente pueda
// encontrar a uno por nombre, apellido, correo o RUT y agregarlo a su
// sección sin tener que volver a crearlo. Requiere al menos 2 caracteres
// para evitar traer el listado completo de estudiantes de la plataforma.
export async function GET(req: NextRequest) {
  try {
    await requireDocente();

    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) {
      return NextResponse.json({ estudiantes: [] });
    }

    const estudiantes = await prisma.user.findMany({
      where: {
        rol: "ESTUDIANTE",
        OR: [
          { nombre: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { rut: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, rut: true, nombre: true, email: true },
      orderBy: { nombre: "asc" },
      take: 20,
    });

    return NextResponse.json({ estudiantes });
  } catch (error) {
    return manejarError(error);
  }
}
