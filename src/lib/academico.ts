import { prisma } from "@/lib/prisma";
import { ErrorAcceso } from "@/lib/session";

/** Verifica que la asignatura exista y pertenezca al docente autenticado. */
export async function requireAsignaturaDelDocente(asignaturaId: string, docenteId: string) {
  const asignatura = await prisma.asignatura.findUnique({ where: { id: asignaturaId } });
  if (!asignatura) throw new ErrorAcceso("Asignatura no encontrada", 404);
  if (asignatura.docenteId !== docenteId) throw new ErrorAcceso("No tienes acceso a esta asignatura", 403);
  return asignatura;
}

/** Verifica que la sección exista y pertenezca (vía su asignatura) al docente autenticado. */
export async function requireSeccionDelDocente(seccionId: string, docenteId: string) {
  const seccion = await prisma.seccion.findUnique({
    where: { id: seccionId },
    include: { asignatura: true },
  });
  if (!seccion) throw new ErrorAcceso("Sección no encontrada", 404);
  if (seccion.asignatura.docenteId !== docenteId) throw new ErrorAcceso("No tienes acceso a esta sección", 403);
  return seccion;
}

/** Verifica que el estudiante esté inscrito en la sección (roster fijo). */
export async function requireInscripcion(seccionId: string, estudianteId: string) {
  const inscripcion = await prisma.inscripcion.findUnique({
    where: { seccionId_estudianteId: { seccionId, estudianteId } },
  });
  if (!inscripcion) throw new ErrorAcceso("No estás inscrito en esta sección", 403);
  return inscripcion;
}

/**
 * Verifica que el periodo exista y pertenezca (vía su sección/asignatura) al
 * docente TITULAR autenticado. Usado para gestionar la configuración del
 * periodo (pesos, fechas, rúbrica, equipos, coevaluadores) — no basta con
 * ser coevaluador para estas operaciones.
 */
export async function requirePeriodoDelDocente(periodoId: string, docenteId: string) {
  const periodo = await prisma.periodoEvaluacion.findUnique({
    where: { id: periodoId },
    include: { seccion: { include: { asignatura: true } } },
  });
  if (!periodo) throw new ErrorAcceso("Periodo no encontrado", 404);
  if (periodo.seccion.asignatura.docenteId !== docenteId) {
    throw new ErrorAcceso("No tienes acceso a este periodo", 403);
  }
  return periodo;
}

/**
 * Verifica que el periodo exista y que el docente autenticado pueda
 * REGISTRAR evaluaciones de tipo DOCENTE en él: el titular (dueño de la
 * asignatura) siempre puede, o un coevaluador explícitamente agregado (ver
 * DocenteEvaluador). A diferencia de `requirePeriodoDelDocente`, esto NO
 * autoriza a editar la configuración del periodo ni gestionar equipos.
 */
export async function requireAccesoEvaluacionDocente(periodoId: string, docenteId: string) {
  const periodo = await prisma.periodoEvaluacion.findUnique({
    where: { id: periodoId },
    include: {
      seccion: { include: { asignatura: true } },
      docentesEvaluadores: true,
    },
  });
  if (!periodo) throw new ErrorAcceso("Periodo no encontrado", 404);
  const esTitular = periodo.seccion.asignatura.docenteId === docenteId;
  const esCoevaluador = periodo.docentesEvaluadores.some((d) => d.docenteId === docenteId);
  if (!esTitular && !esCoevaluador) throw new ErrorAcceso("No tienes acceso a este periodo", 403);
  return periodo;
}
