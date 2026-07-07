import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdministrador, ErrorAcceso } from "@/lib/session";
import { manejarError } from "@/lib/api-helpers";

// Perfil completo de un docente visto por el administrador: sus datos y
// todas sus asignaturas con secciones (sin importar el año-semestre), para
// poder "entrar" a su espacio de trabajo igual que si fuera el propio
// docente (ver /admin/docentes/[id] y /admin/asignaturas/[id]).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdministrador();

    const usuario = await prisma.user.findUnique({ where: { id: params.id } });
    if (!usuario || usuario.rol !== "DOCENTE") throw new ErrorAcceso("Docente no encontrado", 404);

    const docente = {
      id: usuario.id,
      rut: usuario.rut,
      nombre: usuario.nombre,
      email: usuario.email,
      activo: usuario.activo,
      ultimoLogin: usuario.ultimoLogin,
      createdAt: usuario.createdAt,
    };

    const asignaturas = await prisma.asignatura.findMany({
      where: { docenteId: params.id },
      orderBy: { createdAt: "desc" },
      include: {
        secciones: {
          include: {
            periodoAcademico: true,
            _count: { select: { inscripciones: true, evaluaciones: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json({ docente, asignaturas });
  } catch (error) {
    return manejarError(error);
  }
}
