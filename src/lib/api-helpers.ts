import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { ErrorAcceso } from "@/lib/session";

export function manejarError(error: unknown) {
  if (error instanceof ErrorAcceso) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Datos inválidos", detalles: error.flatten() }, { status: 400 });
  }
  // Violación de restricción única (ej. nombre de equipo/rúbrica repetido,
  // correo ya registrado): mensaje claro en vez de un 500 genérico.
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const campos = ((error.meta?.target as string[] | undefined) ?? []).join(", ");
    return NextResponse.json(
      { error: `Ya existe un registro con ese mismo valor${campos ? ` (${campos})` : ""}.` },
      { status: 409 }
    );
  }
  if (error instanceof Error) {
    console.error(error);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
  console.error(error);
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}
