import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdministrador, ErrorAcceso } from "@/lib/session";
import { manejarError } from "@/lib/api-helpers";
import { generarPasswordTemporal, hashPassword } from "@/lib/passwords";

const crearDocenteSchema = z.object({
  nombre: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).optional(),
});

export async function GET() {
  try {
    await requireAdministrador();

    const docentes = await prisma.user.findMany({
      where: { rol: "DOCENTE" },
      select: {
        id: true,
        nombre: true,
        email: true,
        activo: true,
        createdAt: true,
        _count: { select: { asignaturas: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ docentes });
  } catch (error) {
    return manejarError(error);
  }
}

// El administrador crea directamente una cuenta docente (a diferencia del
// registro público en /registro, aquí no hace falta que el propio docente
// se registre). La contraseña temporal se devuelve una única vez.
export async function POST(req: NextRequest) {
  try {
    await requireAdministrador();
    const body = crearDocenteSchema.parse(await req.json());
    const email = body.email.toLowerCase().trim();

    const existente = await prisma.user.findUnique({ where: { email } });
    if (existente) throw new ErrorAcceso("Ya existe una cuenta con ese correo", 409);

    const passwordTemporal = body.password ?? generarPasswordTemporal();
    const passwordHash = await hashPassword(passwordTemporal);

    const docente = await prisma.user.create({
      data: { nombre: body.nombre, email, passwordHash, rol: "DOCENTE" },
    });

    return NextResponse.json(
      { docente: { id: docente.id, nombre: docente.nombre, email: docente.email }, passwordTemporal },
      { status: 201 }
    );
  } catch (error) {
    return manejarError(error);
  }
}
