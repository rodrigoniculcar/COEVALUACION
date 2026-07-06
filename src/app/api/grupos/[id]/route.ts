import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireDocente, ErrorAcceso } from "@/lib/session";
import { manejarError } from "@/lib/api-helpers";

const editarGrupoSchema = z.object({
  nombre: z.string().min(1).max(80).optional(),
  estudianteIds: z.array(z.string()).min(1).max(50).optional(),
});

async function requireGrupoDelDocente(grupoId: string, docenteId: string) {
  const grupo = await prisma.grupo.findUnique({
    where: { id: grupoId },
    include: { periodo: { include: { seccion: { include: { asignatura: true } } } } },
  });
  if (!grupo) throw new ErrorAcceso("Grupo no encontrado", 404);
  if (grupo.periodo.seccion.asignatura.docenteId !== docenteId) {
    throw new ErrorAcceso("No tienes acceso a este grupo", 403);
  }
  return grupo;
}

// Renombra el equipo y/o reemplaza su lista de integrantes. Los equipos
// pueden reorganizarse entre un periodo de evaluación y otro; lo que ya se
// evaluó no se pierde ni cambia (cada Resultado guarda una foto del equipo
// tal como estaba en el momento del cálculo, ver Resultado.grupoNombre /
// integrantesHistoricos), así que editar aquí solo afecta hacia adelante.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const docente = await requireDocente();
    const grupo = await requireGrupoDelDocente(params.id, docente.id);
    const body = editarGrupoSchema.parse(await req.json());

    if (body.estudianteIds) {
      const inscritos = await prisma.inscripcion.findMany({
        where: { seccionId: grupo.periodo.seccionId, estudianteId: { in: body.estudianteIds } },
      });
      if (inscritos.length !== body.estudianteIds.length) {
        throw new ErrorAcceso("Uno o más estudiantes no están inscritos en esta sección", 400);
      }
    }

    const actualizado = await prisma.$transaction(async (tx) => {
      if (body.estudianteIds) {
        await tx.miembroGrupo.deleteMany({ where: { grupoId: grupo.id } });
        await tx.miembroGrupo.createMany({
          data: body.estudianteIds.map((estudianteId) => ({ grupoId: grupo.id, estudianteId })),
        });
      }
      return tx.grupo.update({
        where: { id: grupo.id },
        data: { nombre: body.nombre },
        include: { miembros: { include: { estudiante: { select: { id: true, nombre: true } } } } },
      });
    });

    return NextResponse.json({ grupo: actualizado });
  } catch (error) {
    return manejarError(error);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const docente = await requireDocente();
    await requireGrupoDelDocente(params.id, docente.id);

    await prisma.grupo.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return manejarError(error);
  }
}
