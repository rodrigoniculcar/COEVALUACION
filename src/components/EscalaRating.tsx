"use client";

const MAX_ESTRELLAS = 10;

// Control visual de puntaje para calificar un criterio de la rúbrica.
// Con escalas cortas (hasta 10 valores, lo típico: 1-5, 0-5, 1-7, etc.) se
// dibuja una estrella por cada valor posible, de menor a mayor. Con escalas
// más amplias se usa un control deslizante para que siga siendo usable.
export function EscalaRating({
  escalaMin,
  escalaMax,
  valor,
  onChange,
}: {
  escalaMin: number;
  escalaMax: number;
  valor: number | undefined;
  onChange: (valor: number) => void;
}) {
  const actual = valor ?? escalaMin;
  const totalOpciones = escalaMax - escalaMin + 1;

  if (totalOpciones > MAX_ESTRELLAS) {
    return (
      <div className="flex flex-col gap-1">
        <input
          type="range"
          min={escalaMin}
          max={escalaMax}
          step={1}
          value={actual}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="text-sm text-slate-600">
          Puntaje: {actual} / {escalaMax}
        </span>
      </div>
    );
  }

  const opciones = Array.from({ length: totalOpciones }, (_, i) => escalaMin + i);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {opciones.map((opcion) => {
        // Si aún no se ha elegido nada, no se resalta ninguna estrella.
        const relleno = valor !== undefined && opcion <= actual;
        return (
          <button
            key={opcion}
            type="button"
            onClick={() => onChange(opcion)}
            className="p-0.5"
            title={`${opcion}`}
            aria-label={`Calificar con ${opcion} de ${escalaMax}`}
          >
            <svg
              className={`h-7 w-7 transition-colors ${relleno ? "text-amber-400" : "text-slate-300"}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1 1 5.8L10 14.9l-5.21 2.74 1-5.8-4.21-4.1 5.82-.85L10 1.5z" />
            </svg>
          </button>
        );
      })}
      <span className="ml-2 text-sm text-slate-600">
        {valor ?? escalaMin} / {escalaMax}
      </span>
    </div>
  );
}
