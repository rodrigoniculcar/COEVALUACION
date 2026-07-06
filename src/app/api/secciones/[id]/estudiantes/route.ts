import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireDocente } from "@/lib/session";
import { requireSeccionDelDocente } from "@/lib/academico";
import { manejarError } from "@/lib/api-helpers";
import { generarPasswordTemporal, hashPassword } from "@/lib/passwords";

const estudianteSchema = z.object({
  rut: z.string().trim().min(3).max(20).optional(),
  nombre: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).optional(),
});

const cargaSchema = z.object({
  estudiantes: z.array(estudianteSchema).min(1).max(300),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const docente = await requireDocente();
    await requireSeccionDelDocente(params.id, docente.id);

    const inscripciones = await prisma.inscripcion.findMany({
      where: { seccionId: params.id },
      include: { estudiante: { select: { id: true, nombre: true, email: true, createdAt: true } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ inscripciones });
  } catch (error) {
    return manejarError(error);
  }
}

// Carga masiva de estudiantes a la sección (el roster es fijo mientras dura
// esa sección). Si el correo ya existe se reutiliza la cuenta (solo se
// matricula); si no existe se crea con una contraseña temporal que se
// devuelve UNA sola vez en la respuesta para que el docente la comparta de
// forma segura (no se puede recuperar después: solo se almacena el hash).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const docente = await requireDocente();
    await requireSeccionDelDocente(params.id, docente.id);
    const body = cargaSchema.parse(await req.json());

    const resultado = [];

    for (const est of body.estudiantes) {
      const email = est.email.toLowerCase().trim();
      const rut = est.rut?.trim() || undefined;
      let usuario = await prisma.user.findUnique({ where: { email } });
      let passwordTemporal: string | null = null;

      if (!usuario) {
        if (rut) {
          const rutEnUso = await prisma.user.findUnique({ where: { rut } });
          if (rutEnUso) {
            resultado.push({ email, estado: "omitido", motivo: `El RUT ${rut} ya pertenece a otra cuenta` });
            continue;
          }
        }
        passwordTemporal = est.password ?? generarPasswordTemporal();
        const passwordHash = await hashPassword(passwordTemporal);
        usuario = await prisma.user.create({
          data: { nombre: est.nombre, email, rut, passwordHash, rol: "ESTUDIANTE" },
        });
      } else if (usuario.rol !== "ESTUDIANTE") {
        resultado.push({ email, estado: "omitido", motivo: "El correo pertenece a una cuenta docente" });
        continue;
      }

      await prisma.inscripcion.upsert({
        where: { seccionId_estudianteId: { seccionId: params.id, estudianteId: usuario.id } },
        create: { seccionId: params.id, estudianteId: usuario.id },
        update: {},
      });

      resultado.push({
        email,
        estado: "matriculado",
        nombre: usuario.nombre,
        passwordTemporal,
      });
    }

    return NextResponse.json({ resultado }, { status: 201 });
  } catch (error) {
    return manejarError(error);
  }
}
