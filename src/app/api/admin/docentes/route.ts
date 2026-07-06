import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdministrador } from "@/lib/session";
import { manejarError } from "@/lib/api-helpers";
import { generarPasswordTemporal, hashPassword } from "@/lib/passwords";

const docenteSchema = z.object({
  rut: z.string().trim().min(3).max(20).optional(),
  nombre: z.string().min(2).max(120),
  email: z.string().email(),
});

const cargaSchema = z.object({
  docentes: z.array(docenteSchema).min(1).max(500),
  // Si se define, se usa la MISMA contraseña para todos los docentes de
  // esta carga; si no, cada uno recibe una contraseña aleatoria distinta.
  passwordGenerica: z.string().min(8).optional(),
});

export async function GET() {
  try {
    await requireAdministrador();

    const docentes = await prisma.user.findMany({
      where: { rol: "DOCENTE" },
      select: {
        id: true,
        rut: true,
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

// El administrador crea directamente cuentas docente (a diferencia del
// registro público en /registro), de forma individual o en bloque
// (manual/Excel). Si el correo ya existe, se deja la cuenta intacta y solo
// se reporta — nunca se sobreescriben sus datos.
export async function POST(req: NextRequest) {
  try {
    await requireAdministrador();
    const body = cargaSchema.parse(await req.json());

    const resultado = [];

    for (const doc of body.docentes) {
      const email = doc.email.toLowerCase().trim();
      const rut = doc.rut?.trim() || undefined;

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

      const docente = await prisma.user.create({
        data: { nombre: doc.nombre, email, rut, passwordHash, rol: "DOCENTE" },
      });

      resultado.push({ email, estado: "creado", nombre: docente.nombre, passwordTemporal });
    }

    return NextResponse.json({ resultado }, { status: 201 });
  } catch (error) {
    return manejarError(error);
  }
}
