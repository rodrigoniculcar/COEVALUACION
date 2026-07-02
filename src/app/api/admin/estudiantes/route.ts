import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdministrador, ErrorAcceso } from "@/lib/session";
import { manejarError } from "@/lib/api-helpers";
import { generarPasswordTemporal, hashPassword } from "@/lib/passwords";

const crearEstudianteSchema = z.object({
  nombre: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).optional(),
});

export async function GET() {
  try {
    await requireAdministrador();

    const estudiantes = await prisma.user.findMany({
      where: { rol: "ESTUDIANTE" },
      select: {
        id: true,
        nombre: true,
        email: true,
        activo: true,
        createdAt: true,
        _count: { select: { inscripciones: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ estudiantes });
  } catch (error) {
    return manejarError(error);
  }
}

// Crea la cuenta del estudiante sin matricularlo todavía en ningún curso;
// la matrícula la hace el docente desde su curso (o el administrador desde
// /api/admin/cursos/[id]/inscribir).
export async function POST(req: NextRequest) {
  try {
    await requireAdministrador();
    const body = crearEstudianteSchema.parse(await req.json());
    const email = body.email.toLowerCase().trim();

    const existente = await prisma.user.findUnique({ where: { email } });
    if (existente) throw new ErrorAcceso("Ya existe una cuenta con ese correo", 409);

    const passwordTemporal = body.password ?? generarPasswordTemporal();
    const passwordHash = await hashPassword(passwordTemporal);

    const estudiante = await prisma.user.create({
      data: { nombre: body.nombre, email, passwordHash, rol: "ESTUDIANTE" },
    });

    return NextResponse.json(
      { estudiante: { id: estudiante.id, nombre: estudiante.nombre, email: estudiante.email }, passwordTemporal },
      { status: 201 }
    );
  } catch (error) {
    return manejarError(error);
  }
}
