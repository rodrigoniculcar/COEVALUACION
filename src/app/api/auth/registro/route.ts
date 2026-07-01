import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { manejarError } from "@/lib/api-helpers";
import { ErrorAcceso } from "@/lib/session";

const registroSchema = z.object({
  nombre: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

// Registro público, exclusivo para cuentas DOCENTE. Los estudiantes nunca
// se autorregistran: sus credenciales las crea el docente al cargarlos a
// un curso (ver /api/cursos/[id]/estudiantes).
export async function POST(req: NextRequest) {
  try {
    const body = registroSchema.parse(await req.json());
    const email = body.email.toLowerCase().trim();

    const existente = await prisma.user.findUnique({ where: { email } });
    if (existente) throw new ErrorAcceso("Ya existe una cuenta con ese correo", 409);

    const passwordHash = await bcrypt.hash(body.password, 12);
    const usuario = await prisma.user.create({
      data: { nombre: body.nombre, email, passwordHash, rol: "DOCENTE" },
    });

    return NextResponse.json({ usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email } }, { status: 201 });
  } catch (error) {
    return manejarError(error);
  }
}
