import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdministrador } from "@/lib/session";
import { manejarError } from "@/lib/api-helpers";
import { generarPasswordTemporal, hashPassword } from "@/lib/passwords";

const estudianteSchema = z.object({
  rut: z.string().trim().min(3).max(20).optional(),
  nombre: z.string().min(2).max(120),
  email: z.string().email(),
});

const cargaSchema = z.object({
  estudiantes: z.array(estudianteSchema).min(1).max(500),
  // Si se define, se usa la MISMA contraseña para todos los estudiantes de
  // esta carga (más fácil de comunicar en un solo aviso); si no, cada uno
  // recibe una contraseña aleatoria distinta.
  passwordGenerica: z.string().min(8).optional(),
});

export async function GET() {
  try {
    await requireAdministrador();

    const estudiantes = await prisma.user.findMany({
      where: { rol: "ESTUDIANTE" },
      select: {
        id: true,
        rut: true,
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

// Crea (o, si el correo ya existe, deja intacta) la cuenta de cada
// estudiante, sin matricularlo todavía en ninguna sección; la matrícula la
// hace el docente desde su sección, o el administrador desde
// /api/admin/secciones/[id]/inscribir. Igual que la carga del docente: si el
// correo ya existe, NO se sobreescriben sus datos (nombre/rut), solo se
// reporta que ya existía.
export async function POST(req: NextRequest) {
  try {
    await requireAdministrador();
    const body = cargaSchema.parse(await req.json());

    const resultado = [];

    for (const est of body.estudiantes) {
      const email = est.email.toLowerCase().trim();
      const rut = est.rut?.trim() || undefined;

      const existente = await prisma.user.findUnique({ where: { email } });
      if (existente) {
        resultado.push({ email, estado: "existente", nombre: existente.nombre, passwordTemporal: null });
        continue;
      }

      if (rut) {
        const rutEnUso = await prisma.user.findUnique({ where: { rut } });
        if (rutEnUso) {
          resultado.push({ email, estado: "omitido", motivo: `El RUT ${rut} ya pertenece a otra cuenta` });
          continue;
        }
      }

      const passwordTemporal = body.passwordGenerica ?? generarPasswordTemporal();
      const passwordHash = await hashPassword(passwordTemporal);

      const estudiante = await prisma.user.create({
        data: { nombre: est.nombre, email, rut, passwordHash, rol: "ESTUDIANTE" },
      });

      resultado.push({ email, estado: "creado", nombre: estudiante.nombre, passwordTemporal });
    }

    return NextResponse.json({ resultado }, { status: 201 });
  } catch (error) {
    return manejarError(error);
  }
}
