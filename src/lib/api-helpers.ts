import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ErrorAcceso } from "@/lib/session";

export function manejarError(error: unknown) {
  if (error instanceof ErrorAcceso) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Datos inválidos", detalles: error.flatten() }, { status: 400 });
  }
  if (error instanceof Error) {
    console.error(error);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
  console.error(error);
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}
