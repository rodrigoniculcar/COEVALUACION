-- Marca cuál es el año-semestre vigente (usado para filtrar por defecto
-- los resultados del estudiante al periodo actual).
ALTER TABLE "PeriodoAcademico" ADD COLUMN     "actual" BOOLEAN NOT NULL DEFAULT false;
