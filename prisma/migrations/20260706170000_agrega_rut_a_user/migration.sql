-- Agrega RUT (opcional, único) para identificar estudiantes y docentes al
-- cargarlos en bloque desde el panel de administrador o desde una sección.
ALTER TABLE "User" ADD COLUMN     "rut" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_rut_key" ON "User"("rut");
