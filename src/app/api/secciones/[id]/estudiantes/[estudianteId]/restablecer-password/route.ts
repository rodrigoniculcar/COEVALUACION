import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDocente, ErrorAcceso } from "@/lib/session";
import { requireSeccionDelDocente } from "@/lib/academico";
import { manejarError } from "@/lib/api-helpers";
import { generarPasswordTemporal, hashPassword } from "@/lib/passwords";

// Las contraseñas nunca se guardan en texto plano, así que no existe forma
// de "ver" la contraseña actual de un estudiante (ni el docente ni el
// administrador pueden recuperarla). Lo que sí se puede hacer, y es la
// práctica correcta, es generar una contraseña temporal NUEVA para que el
// docente se la vuelva a compartir al estudiante.
export async function POST(
  _req: Request,
  { params }: { params: { id: string; estudianteId: string } }
) {
  try {
    const docente = await requireDocente();
    await requireSeccionDelDocente(params.id, docente.id);

    const inscripcion = await prisma.inscripcion.findUnique({
      where: { seccionId_estudianteId: { seccionId: params.id, estudianteId: params.estudianteId } },
      include: { estudiante: true },
    });
    if (!inscripcion) throw new ErrorAcceso("Ese estudiante no está matriculado en esta sección", 404);

    const passwordTemporal = generarPasswordTemporal();
    const passwordHash = await hashPassword(passwordTemporal);

    await prisma.user.update({
      where: { id: params.estudianteId },
      data: { passwordHash },
    });

    return NextResponse.json({
      email: inscripcion.estudiante.email,
      nombre: inscripcion.estudiante.nombre,
      passwordTemporal,
    });
  } catch (error) {
    return manejarError(error);
  }
}
