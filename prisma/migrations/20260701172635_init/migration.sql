-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('DOCENTE', 'ESTUDIANTE');

-- CreateEnum
CREATE TYPE "EstadoPeriodo" AS ENUM ('BORRADOR', 'ABIERTO', 'CERRADO');

-- CreateEnum
CREATE TYPE "TipoEvaluacion" AS ENUM ('AUTOEVALUACION', 'COEVALUACION', 'DOCENTE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Curso" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "docenteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Curso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inscripcion" (
    "id" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inscripcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grupo" (
    "id" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Grupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiembroGrupo" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,

    CONSTRAINT "MiembroGrupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rubrica" (
    "id" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "escalaMin" INTEGER NOT NULL DEFAULT 1,
    "escalaMax" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rubrica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CriterioRubrica" (
    "id" TEXT NOT NULL,
    "rubricaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "ponderacion" DOUBLE PRECISION NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CriterioRubrica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodoEvaluacion" (
    "id" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "rubricaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "pesoAutoevaluacion" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "pesoCoevaluacion" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "pesoDocente" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "estado" "EstadoPeriodo" NOT NULL DEFAULT 'BORRADOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodoEvaluacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluacion" (
    "id" TEXT NOT NULL,
    "periodoId" TEXT NOT NULL,
    "tipo" "TipoEvaluacion" NOT NULL,
    "evaluadorId" TEXT NOT NULL,
    "evaluadoId" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "comentario" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evaluacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetalleEvaluacion" (
    "id" TEXT NOT NULL,
    "evaluacionId" TEXT NOT NULL,
    "criterioId" TEXT NOT NULL,
    "puntaje" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "DetalleEvaluacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resultado" (
    "id" TEXT NOT NULL,
    "periodoId" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "notaAutoevaluacion" DOUBLE PRECISION,
    "notaCoevaluacion" DOUBLE PRECISION,
    "notaDocente" DOUBLE PRECISION,
    "notaFinal" DOUBLE PRECISION NOT NULL,
    "detalleCriterios" JSONB NOT NULL,
    "retroalimentacion" TEXT NOT NULL,
    "calculadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Resultado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Curso_codigo_key" ON "Curso"("codigo");

-- CreateIndex
CREATE INDEX "Curso_docenteId_idx" ON "Curso"("docenteId");

-- CreateIndex
CREATE INDEX "Inscripcion_estudianteId_idx" ON "Inscripcion"("estudianteId");

-- CreateIndex
CREATE UNIQUE INDEX "Inscripcion_cursoId_estudianteId_key" ON "Inscripcion"("cursoId", "estudianteId");

-- CreateIndex
CREATE UNIQUE INDEX "Grupo_cursoId_nombre_key" ON "Grupo"("cursoId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "MiembroGrupo_grupoId_estudianteId_key" ON "MiembroGrupo"("grupoId", "estudianteId");

-- CreateIndex
CREATE INDEX "CriterioRubrica_rubricaId_idx" ON "CriterioRubrica"("rubricaId");

-- CreateIndex
CREATE INDEX "PeriodoEvaluacion_cursoId_idx" ON "PeriodoEvaluacion"("cursoId");

-- CreateIndex
CREATE INDEX "Evaluacion_periodoId_evaluadoId_idx" ON "Evaluacion"("periodoId", "evaluadoId");

-- CreateIndex
CREATE UNIQUE INDEX "Evaluacion_periodoId_tipo_evaluadorId_evaluadoId_key" ON "Evaluacion"("periodoId", "tipo", "evaluadorId", "evaluadoId");

-- CreateIndex
CREATE UNIQUE INDEX "DetalleEvaluacion_evaluacionId_criterioId_key" ON "DetalleEvaluacion"("evaluacionId", "criterioId");

-- CreateIndex
CREATE INDEX "Resultado_periodoId_grupoId_idx" ON "Resultado"("periodoId", "grupoId");

-- CreateIndex
CREATE UNIQUE INDEX "Resultado_periodoId_estudianteId_key" ON "Resultado"("periodoId", "estudianteId");

-- AddForeignKey
ALTER TABLE "Curso" ADD CONSTRAINT "Curso_docenteId_fkey" FOREIGN KEY ("docenteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscripcion" ADD CONSTRAINT "Inscripcion_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscripcion" ADD CONSTRAINT "Inscripcion_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grupo" ADD CONSTRAINT "Grupo_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiembroGrupo" ADD CONSTRAINT "MiembroGrupo_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiembroGrupo" ADD CONSTRAINT "MiembroGrupo_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rubrica" ADD CONSTRAINT "Rubrica_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriterioRubrica" ADD CONSTRAINT "CriterioRubrica_rubricaId_fkey" FOREIGN KEY ("rubricaId") REFERENCES "Rubrica"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodoEvaluacion" ADD CONSTRAINT "PeriodoEvaluacion_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodoEvaluacion" ADD CONSTRAINT "PeriodoEvaluacion_rubricaId_fkey" FOREIGN KEY ("rubricaId") REFERENCES "Rubrica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluacion" ADD CONSTRAINT "Evaluacion_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "PeriodoEvaluacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluacion" ADD CONSTRAINT "Evaluacion_evaluadorId_fkey" FOREIGN KEY ("evaluadorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluacion" ADD CONSTRAINT "Evaluacion_evaluadoId_fkey" FOREIGN KEY ("evaluadoId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluacion" ADD CONSTRAINT "Evaluacion_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleEvaluacion" ADD CONSTRAINT "DetalleEvaluacion_evaluacionId_fkey" FOREIGN KEY ("evaluacionId") REFERENCES "Evaluacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleEvaluacion" ADD CONSTRAINT "DetalleEvaluacion_criterioId_fkey" FOREIGN KEY ("criterioId") REFERENCES "CriterioRubrica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resultado" ADD CONSTRAINT "Resultado_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "PeriodoEvaluacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resultado" ADD CONSTRAINT "Resultado_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resultado" ADD CONSTRAINT "Resultado_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

