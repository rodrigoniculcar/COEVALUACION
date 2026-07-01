// Motor de cálculo de la nota final ponderada.
//
// Se mantiene como funciones puras (sin acceso a la base de datos) para que
// el algoritmo sea fácil de testear y de auditar: dado un conjunto de
// evaluaciones y pesos, siempre produce el mismo resultado.
//
// Resumen del algoritmo (ver ARCHITECTURE.md, sección 4, para el detalle):
// 1. Cada Evaluacion (autoevaluación, coevaluación o docente) se reduce a
//    una nota 0-100 ponderando sus criterios según CriterioRubrica.ponderacion.
// 2. La coevaluación de un estudiante es el promedio de las notas que le
//    asignó cada compañero de equipo.
// 3. La nota final combina auto/co/docente usando los pesos del periodo
//    (PeriodoEvaluacion.pesoAutoevaluacion/pesoCoevaluacion/pesoDocente).
//    Si falta algún componente, sus puntos se redistribuyen
//    proporcionalmente entre los componentes disponibles.
// 4. Adicionalmente se calcula el promedio ponderado por CRITERIO (no solo
//    el total) para poder identificar los indicadores más bajos.

export interface CriterioInfo {
  id: string;
  nombre: string;
  ponderacion: number; // % dentro de la rúbrica, la suma de todos debe ser 100
}

export interface DetalleInput {
  criterioId: string;
  puntaje: number;
}

export interface EvaluacionInput {
  tipo: "AUTOEVALUACION" | "COEVALUACION" | "DOCENTE";
  evaluadorId: string;
  detalles: DetalleInput[];
}

export interface PesosPeriodo {
  pesoAutoevaluacion: number;
  pesoCoevaluacion: number;
  pesoDocente: number;
}

export interface CriterioResultado {
  criterioId: string;
  nombre: string;
  promedio: number; // 0-100, ponderado entre auto/co/docente igual que la nota final
  esPuntoCritico: boolean;
}

export interface ResultadoCalculado {
  notaAutoevaluacion: number | null;
  notaCoevaluacion: number | null;
  notaDocente: number | null;
  notaFinal: number;
  completo: boolean; // true si los 3 componentes (auto/co/docente) están presentes
  detalleCriterios: CriterioResultado[];
  retroalimentacion: string;
}

/** Normaliza un puntaje dentro de una escala arbitraria (ej. 1-5) a 0-100. */
export function normalizarPuntaje(puntaje: number, escalaMin: number, escalaMax: number): number {
  if (escalaMax === escalaMin) return 100;
  const pct = ((puntaje - escalaMin) / (escalaMax - escalaMin)) * 100;
  return Math.min(100, Math.max(0, pct));
}

/** Nota (0-100) de UNA evaluación individual, ponderando sus criterios. */
export function calcularNotaEvaluacion(
  detalles: DetalleInput[],
  criterios: CriterioInfo[],
  escalaMin: number,
  escalaMax: number
): number {
  const pesoTotal = criterios.reduce((acc, c) => acc + c.ponderacion, 0) || 100;
  let nota = 0;
  for (const criterio of criterios) {
    const detalle = detalles.find((d) => d.criterioId === criterio.id);
    if (!detalle) continue;
    const normalizado = normalizarPuntaje(detalle.puntaje, escalaMin, escalaMax);
    nota += normalizado * (criterio.ponderacion / pesoTotal);
  }
  return nota;
}

/** Promedio simple (0-100) del puntaje normalizado de un criterio específico dentro de una evaluación. */
function notaCriterioEnEvaluacion(
  detalles: DetalleInput[],
  criterioId: string,
  escalaMin: number,
  escalaMax: number
): number | null {
  const detalle = detalles.find((d) => d.criterioId === criterioId);
  if (!detalle) return null;
  return normalizarPuntaje(detalle.puntaje, escalaMin, escalaMax);
}

/**
 * Combina hasta 3 números opcionales usando pesos, redistribuyendo
 * proporcionalmente el peso de los componentes ausentes entre los presentes.
 * Devuelve null si ningún componente está disponible.
 */
function combinarPonderado(
  valores: { valor: number | null; peso: number }[]
): number | null {
  const disponibles = valores.filter((v) => v.valor !== null && v.peso > 0);
  const pesoDisponible = disponibles.reduce((acc, v) => acc + v.peso, 0);
  if (pesoDisponible === 0) return null;
  return disponibles.reduce((acc, v) => acc + (v.valor as number) * (v.peso / pesoDisponible), 0);
}

const UMBRAL_PUNTO_CRITICO = 60; // por debajo de este puntaje (0-100) se marca como indicador a mejorar

export function calcularResultadoEstudiante(params: {
  autoevaluacion: EvaluacionInput | null;
  coevaluaciones: EvaluacionInput[]; // una por cada compañero que evaluó a este estudiante
  docente: EvaluacionInput | null;
  criterios: CriterioInfo[];
  escalaMin: number;
  escalaMax: number;
  pesos: PesosPeriodo;
}): ResultadoCalculado {
  const { autoevaluacion, coevaluaciones, docente, criterios, escalaMin, escalaMax, pesos } = params;

  const notaAutoevaluacion = autoevaluacion
    ? calcularNotaEvaluacion(autoevaluacion.detalles, criterios, escalaMin, escalaMax)
    : null;

  const notasCoevaluacionIndividuales = coevaluaciones.map((c) =>
    calcularNotaEvaluacion(c.detalles, criterios, escalaMin, escalaMax)
  );
  const notaCoevaluacion =
    notasCoevaluacionIndividuales.length > 0
      ? notasCoevaluacionIndividuales.reduce((a, b) => a + b, 0) / notasCoevaluacionIndividuales.length
      : null;

  const notaDocente = docente
    ? calcularNotaEvaluacion(docente.detalles, criterios, escalaMin, escalaMax)
    : null;

  const notaFinal =
    combinarPonderado([
      { valor: notaAutoevaluacion, peso: pesos.pesoAutoevaluacion },
      { valor: notaCoevaluacion, peso: pesos.pesoCoevaluacion },
      { valor: notaDocente, peso: pesos.pesoDocente },
    ]) ?? 0;

  const completo = notaAutoevaluacion !== null && notaCoevaluacion !== null && notaDocente !== null;

  const detalleCriterios: CriterioResultado[] = criterios.map((criterio) => {
    const autoC = autoevaluacion
      ? notaCriterioEnEvaluacion(autoevaluacion.detalles, criterio.id, escalaMin, escalaMax)
      : null;
    const coValores = coevaluaciones
      .map((c) => notaCriterioEnEvaluacion(c.detalles, criterio.id, escalaMin, escalaMax))
      .filter((v): v is number => v !== null);
    const coC = coValores.length > 0 ? coValores.reduce((a, b) => a + b, 0) / coValores.length : null;
    const docC = docente
      ? notaCriterioEnEvaluacion(docente.detalles, criterio.id, escalaMin, escalaMax)
      : null;

    const promedio =
      combinarPonderado([
        { valor: autoC, peso: pesos.pesoAutoevaluacion },
        { valor: coC, peso: pesos.pesoCoevaluacion },
        { valor: docC, peso: pesos.pesoDocente },
      ]) ?? 0;

    return {
      criterioId: criterio.id,
      nombre: criterio.nombre,
      promedio,
      esPuntoCritico: promedio < UMBRAL_PUNTO_CRITICO,
    };
  });

  const retroalimentacion = generarRetroalimentacion(detalleCriterios, notaFinal, completo);

  return {
    notaAutoevaluacion,
    notaCoevaluacion,
    notaDocente,
    notaFinal,
    completo,
    detalleCriterios,
    retroalimentacion,
  };
}

/**
 * Retroalimentación automática basada en reglas: identifica el/los
 * indicadores más débiles y el más fuerte, y arma un texto orientado a la
 * mejora. Determinístico por diseño (mismo input -> mismo output), útil
 * como base sobre la que después se podría enchufar generación con LLM.
 */
export function generarRetroalimentacion(
  detalleCriterios: CriterioResultado[],
  notaFinal: number,
  completo: boolean
): string {
  if (detalleCriterios.length === 0) {
    return "Aún no hay suficientes evaluaciones registradas para generar retroalimentación.";
  }

  const ordenados = [...detalleCriterios].sort((a, b) => a.promedio - b.promedio);
  const criticos = ordenados.filter((c) => c.esPuntoCritico);
  const mejor = ordenados[ordenados.length - 1];

  const partes: string[] = [];

  if (notaFinal >= 85) {
    partes.push(`Desempeño destacado (${notaFinal.toFixed(1)}/100).`);
  } else if (notaFinal >= 70) {
    partes.push(`Buen desempeño general (${notaFinal.toFixed(1)}/100), con espacio de mejora puntual.`);
  } else if (notaFinal >= 60) {
    partes.push(`Desempeño aceptable (${notaFinal.toFixed(1)}/100), pero con indicadores que requieren atención.`);
  } else {
    partes.push(`Desempeño por debajo de lo esperado (${notaFinal.toFixed(1)}/100). Se recomienda un plan de mejora.`);
  }

  if (criticos.length > 0) {
    const nombres = criticos.slice(0, 3).map((c) => `"${c.nombre}" (${c.promedio.toFixed(1)}/100)`);
    partes.push(
      `Puntos críticos a mejorar: ${nombres.join(", ")}. Se sugiere reforzar estos aspectos en el próximo periodo.`
    );
  } else {
    partes.push("No se detectaron indicadores por debajo del umbral crítico.");
  }

  if (mejor && !mejor.esPuntoCritico) {
    partes.push(`Fortaleza principal: "${mejor.nombre}" (${mejor.promedio.toFixed(1)}/100).`);
  }

  if (!completo) {
    partes.push(
      "Nota calculada de forma parcial: aún faltan una o más evaluaciones (autoevaluación, coevaluación o docente) por registrar."
    );
  }

  return partes.join(" ");
}
