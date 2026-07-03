-- AlterTable
ALTER TABLE "Resultado" ADD COLUMN     "grupoNombre" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "integrantesHistoricos" JSONB NOT NULL DEFAULT '[]';

