import { prisma } from "@/lib/prisma";
import { ErrorAcceso } from "@/lib/session";

/** Verifica que el curso exista y pertenezca al docente autenticado. */
export async function requireCursoDelDocente(cursoId: string, docenteId: string) {
  const curso = await prisma.curso.findUnique({ where: { id: cursoId } });
  if (!curso) throw new ErrorAcceso("Curso no encontrado", 404);
  if (curso.docenteId !== docenteId) throw new ErrorAcceso("No tienes acceso a este curso", 403);
  return curso;
}

/** Verifica que el estudiante esté inscrito en el curso. */
export async function requireInscripcion(cursoId: string, estudianteId: string) {
  const inscripcion = await prisma.inscripcion.findUnique({
    where: { cursoId_estudianteId: { cursoId, estudianteId } },
  });
  if (!inscripcion) throw new ErrorAcceso("No estás inscrito en este curso", 403);
  return inscripcion;
}

/** Verifica que el periodo exista y pertenezca (vía su curso) al docente autenticado. */
export async function requirePeriodoDelDocente(periodoId: string, docenteId: string) {
  const periodo = await prisma.periodoEvaluacion.findUnique({
    where: { id: periodoId },
    include: { curso: true },
  });
  if (!periodo) throw new ErrorAcceso("Periodo no encontrado", 404);
  if (periodo.curso.docenteId !== docenteId) throw new ErrorAcceso("No tienes acceso a este periodo", 403);
  return periodo;
}
