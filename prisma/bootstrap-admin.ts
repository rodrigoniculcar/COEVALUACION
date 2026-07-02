import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Script idempotente ejecutado automáticamente en cada build de Vercel
// (ver vercel.json), después de aplicar las migraciones. Crea UNA cuenta
// ADMINISTRADOR y UNA cuenta DOCENTE iniciales si todavía no existen, para
// poder entrar a la plataforma sin tocar la base de datos manualmente.
//
// Es seguro correrlo en cada deploy: usa upsert con `update: {}`, así que
// si la cuenta ya existe (por ejemplo, porque ya cambiaste la contraseña)
// no se sobrescribe nada.
const prisma = new PrismaClient();

const CUENTAS_INICIALES = [
  {
    nombre: "Administrador",
    email: "admin@coevaluacion.app",
    password: "qU6xOv8a39pkyjEh6UHq",
    rol: "ADMINISTRADOR" as const,
  },
  {
    nombre: "Docente Demo",
    email: "docente@coevaluacion.app",
    password: "B4WgoSg1VrtZxE5QFGsl",
    rol: "DOCENTE" as const,
  },
];

async function main() {
  for (const cuenta of CUENTAS_INICIALES) {
    const existente = await prisma.user.findUnique({ where: { email: cuenta.email } });
    if (existente) {
      console.log(`[bootstrap-admin] ${cuenta.email} ya existe, no se modifica.`);
      continue;
    }

    const passwordHash = await bcrypt.hash(cuenta.password, 12);
    await prisma.user.create({
      data: { nombre: cuenta.nombre, email: cuenta.email, passwordHash, rol: cuenta.rol },
    });
    console.log(`[bootstrap-admin] Cuenta ${cuenta.rol} creada: ${cuenta.email}`);
  }
}

main()
  .catch((e) => {
    // No se usa process.exit(1) a propósito: si esto falla (ej. la base de
    // datos aún no está configurada), el build de Vercel debe continuar
    // igual (ver el `|| echo ...` en vercel.json).
    console.error("[bootstrap-admin] No se pudieron crear las cuentas iniciales:", e.message ?? e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
