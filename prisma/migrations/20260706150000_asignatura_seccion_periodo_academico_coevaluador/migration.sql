-- Reestructuración mayor: Asignatura (docente) -> Sección (año-semestre,
-- roster fijo) -> PeriodoEvaluacion (evaluación, con grupos propios).
-- Rubrica pasa a ser una biblioteca pública entre docentes (creadorId en
-- vez de cursoId). Se agrega DocenteEvaluador para coevaluadores docentes.
--
-- Se eliminan las evaluaciones ya registradas (Evaluacion/DetalleEvaluacion
-- /Resultado/Grupo/MiembroGrupo/PeriodoEvaluacion) e Inscripcion, tal como
-- se pidió explícitamente, dado que Sección es una capa nueva obligatoria
-- entre Asignatura e Inscripcion/PeriodoEvaluacion que no existía antes.
-- Los Cursos existentes SÍ se preservan (se renombran a Asignatura sin
-- perder datos) y las Rubricas existentes también se preservan (se les
-- asigna creadorId = el docente dueño del curso al que pertenecían).

-- 1) Borrar datos de evaluación en orden de dependencias (FK).
DELETE FROM "DetalleEvaluacion";
DELETE FROM "Evaluacion";
DELETE FROM "Resultado";
DELETE FROM "MiembroGrupo";
DELETE FROM "Grupo";
DELETE FROM "PeriodoEvaluacion";
DELETE FROM "Inscripcion";

-- 2) Rubrica: agregar creadorId (nullable primero), rellenar desde el
-- docente dueño del Curso actual, y luego dejarlo NOT NULL.
ALTER TABLE "Rubrica" ADD COLUMN "creadorId" TEXT;
UPDATE "Rubrica" r SET "creadorId" = c."docenteId" FROM "Curso" c WHERE r."cursoId" = c."id";
ALTER TABLE "Rubrica" ALTER COLUMN "creadorId" SET NOT NULL;
ALTER TABLE "Rubrica" DROP CONSTRAINT "Rubrica_cursoId_fkey";
ALTER TABLE "Rubrica" DROP COLUMN "cursoId";
ALTER TABLE "Rubrica" ADD CONSTRAINT "Rubrica_creadorId_fkey" FOREIGN KEY ("creadorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3) Inscripcion y PeriodoEvaluacion: quitar cursoId (ya no quedan filas,
-- se borraron en el paso 1).
ALTER TABLE "Inscripcion" DROP CONSTRAINT "Inscripcion_cursoId_fkey";
DROP INDEX "Inscripcion_cursoId_estudianteId_key";
ALTER TABLE "Inscripcion" DROP COLUMN "cursoId";

ALTER TABLE "PeriodoEvaluacion" DROP CONSTRAINT "PeriodoEvaluacion_cursoId_fkey";
DROP INDEX "PeriodoEvaluacion_cursoId_idx";
ALTER TABLE "PeriodoEvaluacion" DROP COLUMN "cursoId";

-- 4) Renombrar Curso -> Asignatura preservando los datos existentes (los
-- cursos que ya existían quedan disponibles como Asignatura del mismo
-- docente, sin necesidad de recrearlos).
ALTER TABLE "Curso" RENAME TO "Asignatura";
ALTER TABLE "Asignatura" RENAME CONSTRAINT "Curso_pkey" TO "Asignatura_pkey";
ALTER TABLE "Asignatura" RENAME CONSTRAINT "Curso_docenteId_fkey" TO "Asignatura_docenteId_fkey";
ALTER INDEX "Curso_codigo_key" RENAME TO "Asignatura_codigo_key";
ALTER INDEX "Curso_docenteId_idx" RENAME TO "Asignatura_docenteId_idx";

-- 5) Catálogo de años-semestre.
CREATE TABLE "PeriodoAcademico" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodoAcademico_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PeriodoAcademico_nombre_key" ON "PeriodoAcademico"("nombre");

-- 6) Sección: instancia concreta de una Asignatura en un PeriodoAcademico.
CREATE TABLE "Seccion" (
    "id" TEXT NOT NULL,
    "asignaturaId" TEXT NOT NULL,
    "periodoAcademicoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Seccion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Seccion_asignaturaId_idx" ON "Seccion"("asignaturaId");
CREATE INDEX "Seccion_periodoAcademicoId_idx" ON "Seccion"("periodoAcademicoId");
CREATE UNIQUE INDEX "Seccion_asignaturaId_periodoAcademicoId_nombre_key" ON "Seccion"("asignaturaId", "periodoAcademicoId", "nombre");
ALTER TABLE "Seccion" ADD CONSTRAINT "Seccion_asignaturaId_fkey" FOREIGN KEY ("asignaturaId") REFERENCES "Asignatura"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Seccion" ADD CONSTRAINT "Seccion_periodoAcademicoId_fkey" FOREIGN KEY ("periodoAcademicoId") REFERENCES "PeriodoAcademico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 7) Inscripcion y PeriodoEvaluacion ahora cuelgan de Seccion (tablas ya
-- vacías, así que se puede agregar la columna NOT NULL directamente).
ALTER TABLE "Inscripcion" ADD COLUMN "seccionId" TEXT NOT NULL;
CREATE UNIQUE INDEX "Inscripcion_seccionId_estudianteId_key" ON "Inscripcion"("seccionId", "estudianteId");
ALTER TABLE "Inscripcion" ADD CONSTRAINT "Inscripcion_seccionId_fkey" FOREIGN KEY ("seccionId") REFERENCES "Seccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PeriodoEvaluacion" ADD COLUMN "seccionId" TEXT NOT NULL;
CREATE INDEX "PeriodoEvaluacion_seccionId_idx" ON "PeriodoEvaluacion"("seccionId");
ALTER TABLE "PeriodoEvaluacion" ADD CONSTRAINT "PeriodoEvaluacion_seccionId_fkey" FOREIGN KEY ("seccionId") REFERENCES "Seccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 8) Coevaluadores docentes de un periodo de evaluación.
CREATE TABLE "DocenteEvaluador" (
    "id" TEXT NOT NULL,
    "periodoId" TEXT NOT NULL,
    "docenteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocenteEvaluador_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DocenteEvaluador_periodoId_docenteId_key" ON "DocenteEvaluador"("periodoId", "docenteId");
ALTER TABLE "DocenteEvaluador" ADD CONSTRAINT "DocenteEvaluador_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "PeriodoEvaluacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocenteEvaluador" ADD CONSTRAINT "DocenteEvaluador_docenteId_fkey" FOREIGN KEY ("docenteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
