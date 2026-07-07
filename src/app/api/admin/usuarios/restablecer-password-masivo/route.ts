import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdministrador } from "@/lib/session";
import { manejarError } from "@/lib/api-helpers";
import { generarPasswordTemporal, hashPassword } from "@/lib/passwords";

const restablecerMasivoSchema = z.object({
  ids: z.array(z.string()).min(1).max(500),
  // Si se define, todos los usuarios seleccionados reciben la MISMA
  // contraseña (más fácil de comunicar en un solo aviso); si no, cada uno
  // recibe una distinta.
  passwordGenerica: z.string().min(8).optional(),
});

// Restablece la contraseña de varios estudiantes/docentes seleccionados a la
// vez. Igual que el reseteo individual, nunca toca cuentas ADMINISTRADOR ni
// la propia cuenta del admin que ejecuta la acción (esas filas simplemente
// se omiten del resultado).
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdministrador();
    const body = restablecerMasivoSchema.parse(await req.json());

    const usuarios = await prisma.user.findMany({ where: { id: { in: body.ids } } });

    const resultado = [];
    for (const usuario of usuarios) {
      if (usuario.rol === "ADMINISTRADOR" || usuario.id === admin.id) {
        resultado.push({ id: usuario.id, email: usuario.email, estado: "omitido" as const, passwordTemporal: null });
        continue;
      }

      const passwordTemporal = body.passwordGenerica ?? generarPasswordTemporal();
      const passwordHash = await hashPassword(passwordTemporal);
      await prisma.user.update({ where: { id: usuario.id }, data: { passwordHash } });

      resultado.push({ id: usuario.id, email: usuario.email, estado: "restablecido" as const, passwordTemporal });
    }

    return NextResponse.json({ resultado });
  } catch (error) {
    return manejarError(error);
  }
}
