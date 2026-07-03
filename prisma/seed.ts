import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { recalcularResultadosPeriodo } from "../src/lib/resultados";

const prisma = new PrismaClient();

async function main() {
  const passwordDemo = "Demo1234";
  const passwordHash = await bcrypt.hash(passwordDemo, 12);

  const docente = await prisma.user.upsert({
    where: { email: "docente@demo.edu" },
    update: {},
    create: { nombre: "María Fernández", email: "docente@demo.edu", passwordHash, rol: "DOCENTE" },
  });

  const nombresEstudiantes = [
    "Ana Torres",
    "Luis Pérez",
    "Camila Rojas",
    "Diego Soto",
    "Valentina Cruz",
    "Martín Ibáñez",
  ];

  const estudiantes = [];
  for (const nombre of nombresEstudiantes) {
    const sinAcentos = nombre.normalize("NFD").replace(/[̀-ͯ]/g, "");
    const email = `${sinAcentos.toLowerCase().replace(/\s+/g, ".")}@demo.edu`;
    const estudiante = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { nombre, email, passwordHash, rol: "ESTUDIANTE" },
    });
    estudiantes.push(estudiante);
  }

  const curso = await prisma.curso.upsert({
    where: { codigo: "EDU-101" },
    update: {},
    create: { nombre: "Proyecto Integrador de EdTech", codigo: "EDU-101", docenteId: docente.id },
  });

  for (const est of estudiantes) {
    await prisma.inscripcion.upsert({
      where: { cursoId_estudianteId: { cursoId: curso.id, estudianteId: est.id } },
      update: {},
      create: { cursoId: curso.id, estudianteId: est.id },
    });
  }

  const rubrica =
    (await prisma.rubrica.findFirst({ where: { cursoId: curso.id }, include: { criterios: true } })) ??
    (await prisma.rubrica.create({
      data: {
        cursoId: curso.id,
        nombre: "Rúbrica de trabajo colaborativo",
        descripcion: "Evalúa la contribución individual dentro del trabajo en equipo.",
        escalaMin: 1,
        escalaMax: 5,
        criterios: {
          create: [
            { nombre: "Cumplimiento de tareas", ponderacion: 30, orden: 0 },
            { nombre: "Comunicación y colaboración", ponderacion: 25, orden: 1 },
            { nombre: "Calidad del trabajo entregado", ponderacion: 25, orden: 2 },
            // Ejemplo de criterio restringido a un solo tipo de evaluador:
            // solo lo evalúa el docente (no aparece en auto/coevaluación).
            {
              nombre: "Puntualidad y responsabilidad",
              ponderacion: 20,
              orden: 3,
              aplicaAutoevaluacion: false,
              aplicaCoevaluacion: false,
              aplicaDocente: true,
            },
          ],
        },
      },
    }));
  const rubricaConCriterios = await prisma.rubrica.findUniqueOrThrow({
    where: { id: rubrica.id },
    include: { criterios: true },
  });

  const periodo =
    (await prisma.periodoEvaluacion.findFirst({ where: { cursoId: curso.id } })) ??
    (await prisma.periodoEvaluacion.create({
      data: {
        cursoId: curso.id,
        rubricaId: rubricaConCriterios.id,
        nombre: "Corte 1",
        fechaInicio: new Date(),
        fechaFin: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        pesoAutoevaluacion: 20,
        pesoCoevaluacion: 40,
        pesoDocente: 40,
        escalaExigencia: 60,
        estado: "ABIERTO",
      },
    }));

  // Los equipos son propios del periodo (pueden cambiar de una evaluación a
  // otra). Se reutilizan los dos primeros equipos existentes de este
  // periodo (por si ya se renombraron al probar la edición) en vez de
  // buscar por nombre exacto, para que correr el seed varias veces no cree
  // duplicados.
  const gruposExistentes = await prisma.grupo.findMany({
    where: { periodoId: periodo.id },
    orderBy: { createdAt: "asc" },
  });

  const grupoA =
    gruposExistentes[0] ??
    (await prisma.grupo.create({
      data: {
        periodoId: periodo.id,
        nombre: "Equipo A",
        miembros: { create: estudiantes.slice(0, 3).map((e) => ({ estudianteId: e.id })) },
      },
    }));

  const grupoB =
    gruposExistentes[1] ??
    (await prisma.grupo.create({
      data: {
        periodoId: periodo.id,
        nombre: "Equipo B",
        miembros: { create: estudiantes.slice(3, 6).map((e) => ({ estudianteId: e.id })) },
      },
    }));

  // Evaluaciones de ejemplo dentro del Equipo A para poder ver el dashboard
  // con datos reales sin tener que llenar todos los formularios a mano.
  const [ana, luis, camila] = estudiantes;
  const criterios = rubricaConCriterios.criterios;
  const puntajesDemo = (base: number) => criterios.map((c, idx) => ({ criterioId: c.id, puntaje: Math.max(1, Math.min(5, base + (idx % 2))) }));

  const crearEvaluacion = async (
    tipo: "AUTOEVALUACION" | "COEVALUACION" | "DOCENTE",
    evaluadorId: string,
    evaluadoId: string,
    base: number
  ) => {
    await prisma.evaluacion.upsert({
      where: { periodoId_tipo_evaluadorId_evaluadoId: { periodoId: periodo.id, tipo, evaluadorId, evaluadoId } },
      update: {},
      create: {
        periodoId: periodo.id,
        tipo,
        evaluadorId,
        evaluadoId,
        grupoId: grupoA.id,
        detalles: { create: puntajesDemo(base) },
      },
    });
  };

  await crearEvaluacion("AUTOEVALUACION", ana.id, ana.id, 4);
  await crearEvaluacion("COEVALUACION", luis.id, ana.id, 4);
  await crearEvaluacion("COEVALUACION", camila.id, ana.id, 3);
  await crearEvaluacion("DOCENTE", docente.id, ana.id, 4);

  await crearEvaluacion("AUTOEVALUACION", luis.id, luis.id, 3);
  await crearEvaluacion("COEVALUACION", ana.id, luis.id, 2);
  await crearEvaluacion("COEVALUACION", camila.id, luis.id, 2);
  await crearEvaluacion("DOCENTE", docente.id, luis.id, 3);

  await recalcularResultadosPeriodo(periodo.id);

  console.log("Seed completado.");
  console.log("Docente -> docente@demo.edu / Demo1234");
  console.log("Estudiantes (misma contraseña Demo1234):");
  estudiantes.forEach((e) => console.log(`  - ${e.email}`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
