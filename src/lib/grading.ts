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
//    asignó cada compañero de equipo. La nota docente funciona igual: si un
//    periodo tiene coevaluadores docentes además del titular, se promedian
//    todas las evaluaciones de tipo DOCENTE en un solo notaDocente.
// 3. La nota final combina auto/co/docente usando los pesos del periodo
//    (PeriodoEvaluacion.pesoAutoevaluacion/pesoCoevaluacion/pesoDocente).
//    Si falta algún componente, sus puntos se redistribuyen
//    proporcionalmente entre los componentes disponibles.
// 4. Adicionalmente se calcula el promedio ponderado por CRITERIO (no solo
//    el total), y también el desglose por fuente (auto/co/docente) de cada
//    criterio, para poder identificar indicadores críticos/fortalezas y
//    explicar de dónde viene cada percepción.

export interface CriterioInfo {
  id: string;
  nombre: string;
  ponderacion: number; // % dentro de la rúbrica, la suma de todos debe ser 100
  // Un criterio puede restringirse a solo algunos tipos de evaluador (ej. un
  // criterio que solo califica el docente). Al menos uno debe ser true.
  aplicaAutoevaluacion: boolean;
  aplicaCoevaluacion: boolean;
  aplicaDocente: boolean;
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
  // Desglose por fuente (0-100), null si esa fuente no evaluó este criterio.
  promedioAuto: number | null;
  promedioCoevaluacion: number | null;
  promedioDocente: number | null;
  esPuntoCritico: boolean;
  esFortaleza: boolean;
}

export interface ResultadoCalculado {
  notaAutoevaluacion: number | null;
  notaCoevaluacion: number | null;
  notaDocente: number | null;
  notaFinal: number;
  // notaFinal (0-100) convertida a escala chilena 1.0-7.0.
  notaEscala1a7: number;
  completo: boolean; // true si los 3 componentes (auto/co/docente) están presentes
  detalleCriterios: CriterioResultado[];
  retroalimentacion: string;
}

/**
 * Convierte un puntaje 0-100 a la escala chilena 1.0-7.0, donde `exigencia`
 * (típicamente 60 o 70) es el porcentaje que corresponde a la nota mínima de
 * aprobación (4.0). Por debajo de la exigencia la nota baja linealmente
 * hasta 1.0 en 0%; por sobre la exigencia sube linealmente hasta 7.0 en 100%.
 */
export function convertirAEscala1a7(porcentaje0a100: number, exigencia: number): number {
  const exigenciaValida = exigencia > 0 && exigencia < 100 ? exigencia : 60;
  const pct = Math.min(100, Math.max(0, porcentaje0a100));
  const nota =
    pct >= exigenciaValida
      ? 4 + ((pct - exigenciaValida) / (100 - exigenciaValida)) * 3
      : 1 + (pct / exigenciaValida) * 3;
  return Math.round(nota * 10) / 10;
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
const UMBRAL_FORTALEZA = 80; // desde este puntaje (0-100) se marca como fortaleza
const BRECHA_NOTABLE = 15; // diferencia (en puntos) para considerar que dos fuentes "no coinciden"

export function calcularResultadoEstudiante(params: {
  autoevaluacion: EvaluacionInput | null;
  coevaluaciones: EvaluacionInput[]; // una por cada compañero que evaluó a este estudiante
  // Una por cada docente evaluador (el titular de la asignatura y, si los
  // hay, los coevaluadores agregados a este periodo). Se promedian igual
  // que la coevaluación entre compañeros.
  docentes: EvaluacionInput[];
  criterios: CriterioInfo[];
  escalaMin: number;
  escalaMax: number;
  escalaExigencia: number;
  pesos: PesosPeriodo;
}): ResultadoCalculado {
  const { autoevaluacion, coevaluaciones, docentes, criterios, escalaMin, escalaMax, escalaExigencia, pesos } = params;

  // Cada tipo de evaluación solo pondera los criterios que le aplican; así
  // el peso se renormaliza a 100% entre los criterios realmente evaluados
  // por esa fuente en vez de diluirse por los que no le corresponden.
  const criteriosAuto = criterios.filter((c) => c.aplicaAutoevaluacion);
  const criteriosCo = criterios.filter((c) => c.aplicaCoevaluacion);
  const criteriosDoc = criterios.filter((c) => c.aplicaDocente);

  const notaAutoevaluacion = autoevaluacion
    ? calcularNotaEvaluacion(autoevaluacion.detalles, criteriosAuto, escalaMin, escalaMax)
    : null;

  const notasCoevaluacionIndividuales = coevaluaciones.map((c) =>
    calcularNotaEvaluacion(c.detalles, criteriosCo, escalaMin, escalaMax)
  );
  const notaCoevaluacion =
    notasCoevaluacionIndividuales.length > 0
      ? notasCoevaluacionIndividuales.reduce((a, b) => a + b, 0) / notasCoevaluacionIndividuales.length
      : null;

  const notasDocenteIndividuales = docentes.map((d) =>
    calcularNotaEvaluacion(d.detalles, criteriosDoc, escalaMin, escalaMax)
  );
  const notaDocente =
    notasDocenteIndividuales.length > 0
      ? notasDocenteIndividuales.reduce((a, b) => a + b, 0) / notasDocenteIndividuales.length
      : null;

  const notaFinal =
    combinarPonderado([
      { valor: notaAutoevaluacion, peso: pesos.pesoAutoevaluacion },
      { valor: notaCoevaluacion, peso: pesos.pesoCoevaluacion },
      { valor: notaDocente, peso: pesos.pesoDocente },
    ]) ?? 0;

  const notaEscala1a7 = convertirAEscala1a7(notaFinal, escalaExigencia);

  const completo = notaAutoevaluacion !== null && notaCoevaluacion !== null && notaDocente !== null;

  const detalleCriterios: CriterioResultado[] = criterios.map((criterio) => {
    const autoC = autoevaluacion
      ? notaCriterioEnEvaluacion(autoevaluacion.detalles, criterio.id, escalaMin, escalaMax)
      : null;
    const coValores = coevaluaciones
      .map((c) => notaCriterioEnEvaluacion(c.detalles, criterio.id, escalaMin, escalaMax))
      .filter((v): v is number => v !== null);
    const coC = coValores.length > 0 ? coValores.reduce((a, b) => a + b, 0) / coValores.length : null;
    const docValores = docentes
      .map((d) => notaCriterioEnEvaluacion(d.detalles, criterio.id, escalaMin, escalaMax))
      .filter((v): v is number => v !== null);
    const docC = docValores.length > 0 ? docValores.reduce((a, b) => a + b, 0) / docValores.length : null;

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
      promedioAuto: autoC,
      promedioCoevaluacion: coC,
      promedioDocente: docC,
      esPuntoCritico: promedio < UMBRAL_PUNTO_CRITICO,
      esFortaleza: promedio >= UMBRAL_FORTALEZA,
    };
  });

  const retroalimentacion = generarRetroalimentacion(detalleCriterios, notaFinal, completo);

  return {
    notaAutoevaluacion,
    notaCoevaluacion,
    notaDocente,
    notaFinal,
    notaEscala1a7,
    completo,
    detalleCriterios,
    retroalimentacion,
  };
}

function describirFuentes(c: CriterioResultado): string {
  const partes: string[] = [];
  if (c.promedioAuto !== null) partes.push(`tu autoevaluación ${c.promedioAuto.toFixed(1)}`);
  if (c.promedioCoevaluacion !== null) partes.push(`tus compañeros ${c.promedioCoevaluacion.toFixed(1)}`);
  if (c.promedioDocente !== null) partes.push(`tu docente ${c.promedioDocente.toFixed(1)}`);
  return partes.join(", ");
}

/** Sugerencia accionable para un indicador bajo, basada en cómo se comparan las fuentes disponibles. */
function sugerenciaParaCritico(c: CriterioResultado): string {
  const { promedioAuto: auto, promedioCoevaluacion: co, promedioDocente: doc } = c;
  const disponibles = [auto, co, doc].filter((v): v is number => v !== null);

  if (disponibles.length < 2) {
    return `Pide a tu docente o a tus compañeros ejemplos concretos sobre "${c.nombre}" para saber exactamente qué acción tomar.`;
  }

  const maxV = Math.max(...disponibles);
  const minV = Math.min(...disponibles);

  if (maxV - minV < BRECHA_NOTABLE) {
    return `Tu autoevaluación, tus compañeros y tu docente coinciden en este puntaje bajo: fija con ellos una meta concreta y medible para el próximo periodo.`;
  }
  if (auto !== null && auto === maxV) {
    return `Te calificaste más alto de lo que te calificaron tus compañeros y/o tu docente en este aspecto: pide ejemplos concretos de qué esperan ver de ti para cerrar esa diferencia de percepción.`;
  }
  if (co !== null && doc !== null && co < doc) {
    return `Tus compañeros de equipo calificaron esto más bajo que tu docente: conversa con tu equipo sobre qué comportamientos concretos esperan de ti aquí.`;
  }
  if (doc !== null && co !== null && doc < co) {
    return `Tu docente calificó esto más bajo que tus compañeros: pide una breve reunión para entender qué evidencia específica espera ver.`;
  }
  return `Hay diferencias de percepción sobre este aspecto entre las evaluaciones recibidas: conversarlo con tu equipo y tu docente ayudará a definir una acción concreta de mejora.`;
}

/** Comentario para un punto fuerte, resaltando si hay consenso entre fuentes. */
function comentarioFortaleza(c: CriterioResultado): string {
  const disponibles = [c.promedioAuto, c.promedioCoevaluacion, c.promedioDocente].filter(
    (v): v is number => v !== null
  );
  if (disponibles.length >= 2 && Math.max(...disponibles) - Math.min(...disponibles) < BRECHA_NOTABLE) {
    return `tanto tus compañeros como tu docente coinciden en reconocer este punto fuerte: aprovecha para apoyar a tu equipo en este aspecto.`;
  }
  return `sigue apoyándote en esta fortaleza para el resto del equipo.`;
}

/**
 * Retroalimentación automática basada en reglas: identifica los indicadores
 * más débiles y más fuertes, compara la percepción de cada fuente
 * (autoevaluación / coevaluación / docente) y sugiere una acción concreta
 * para cada uno. Determinístico por diseño (mismo input -> mismo output),
 * útil como base sobre la que después se podría enchufar generación con LLM
 * para redactar el mensaje en lenguaje más natural a partir de estos mismos
 * datos estructurados.
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
  const criticos = ordenados.filter((c) => c.esPuntoCritico).slice(0, 3);
  const fortalezas = [...ordenados]
    .reverse()
    .filter((c) => c.esFortaleza)
    .slice(0, 2);

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
    partes.push("\n\nPuntos críticos a mejorar:");
    for (const c of criticos) {
      const fuentes = describirFuentes(c);
      partes.push(
        `\n- "${c.nombre}" (${c.promedio.toFixed(1)}/100${fuentes ? `; ${fuentes}` : ""}). ${sugerenciaParaCritico(c)}`
      );
    }
  } else {
    partes.push("\n\nNo se detectaron indicadores por debajo del umbral crítico.");
  }

  if (fortalezas.length > 0) {
    partes.push("\n\nPuntos más altos:");
    for (const f of fortalezas) {
      const fuentes = describirFuentes(f);
      partes.push(
        `\n- "${f.nombre}" (${f.promedio.toFixed(1)}/100${fuentes ? `; ${fuentes}` : ""}). ${comentarioFortaleza(f)}`
      );
    }
  }

  partes.push(
    criticos.length > 0
      ? `\n\nPlan de acción sugerido: elige uno de los puntos críticos de arriba, define una meta concreta y medible para el próximo periodo, y conversa tanto con tu equipo como con tu docente para alinear expectativas.`
      : `\n\nPlan de acción sugerido: mantén el nivel actual y busca oportunidades de mentorear a compañeros en tus puntos más fuertes.`
  );

  if (!completo) {
    partes.push(
      "\n\nNota calculada de forma parcial: aún faltan una o más evaluaciones (autoevaluación, coevaluación o docente) por registrar."
    );
  }

  return partes.join(" ").replace(/ \n/g, "\n");
}
