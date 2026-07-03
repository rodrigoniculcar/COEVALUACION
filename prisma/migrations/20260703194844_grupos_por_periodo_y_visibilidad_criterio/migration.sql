-- Los equipos (Grupo) ahora pertenecen a un PeriodoEvaluacion en vez de a un
-- Curso: la conformación de equipos puede cambiar de una evaluación a otra.
-- No hay datos de producción importantes en estas tablas todavía (confirmado
-- con el usuario), así que se limpian antes de aplicar el nuevo esquema en
-- vez de intentar reconstruir una asignación histórica.
DELETE FROM "DetalleEvaluacion";
DELETE FROM "Evaluacion";
DELETE FROM "Resultado";
DELETE FROM "MiembroGrupo";
DELETE FROM "Grupo";

-- DropForeignKey
ALTER TABLE "Grupo" DROP CONSTRAINT "Grupo_cursoId_fkey";

-- DropIndex
DROP INDEX "Grupo_cursoId_nombre_key";

-- AlterTable
ALTER TABLE "CriterioRubrica" ADD COLUMN     "aplicaAutoevaluacion" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "aplicaCoevaluacion" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "aplicaDocente" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Grupo" DROP COLUMN "cursoId",
ADD COLUMN     "periodoId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PeriodoEvaluacion" ADD COLUMN     "escalaExigencia" INTEGER NOT NULL DEFAULT 60;

-- AlterTable
ALTER TABLE "Resultado" ADD COLUMN     "notaEscala1a7" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "Grupo_periodoId_nombre_key" ON "Grupo"("periodoId", "nombre");

-- AddForeignKey
ALTER TABLE "Grupo" ADD CONSTRAINT "Grupo_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "PeriodoEvaluacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
