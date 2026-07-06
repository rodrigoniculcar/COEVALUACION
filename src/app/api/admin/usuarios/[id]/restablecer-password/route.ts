import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdministrador, ErrorAcceso } from "@/lib/session";
import { manejarError } from "@/lib/api-helpers";
import { generarPasswordTemporal, hashPassword } from "@/lib/passwords";

// El administrador puede restablecer la contraseña de cualquier estudiante
// o docente (no se puede recuperar la actual, solo se guarda el hash). No
// se permite sobre una cuenta ADMINISTRADOR desde este panel, igual que el
// resto de las acciones administrativas sobre usuarios.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdministrador();

    const usuario = await prisma.user.findUnique({ where: { id: params.id } });
    if (!usuario) throw new ErrorAcceso("Usuario no encontrado", 404);
    if (usuario.rol === "ADMINISTRADOR") {
      throw new ErrorAcceso("No se puede restablecer la contraseña de una cuenta administradora desde aquí", 400);
    }
    if (usuario.id === admin.id) {
      throw new ErrorAcceso("No puedes restablecer tu propia contraseña desde aquí", 400);
    }

    const passwordTemporal = generarPasswordTemporal();
    const passwordHash = await hashPassword(passwordTemporal);

    await prisma.user.update({ where: { id: usuario.id }, data: { passwordHash } });

    return NextResponse.json({ email: usuario.email, nombre: usuario.nombre, passwordTemporal });
  } catch (error) {
    return manejarError(error);
  }
}
