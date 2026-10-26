/* =========================
   Échelles des graphiques

   Domaine arrondi à des graduations propres (1, 2, 2.5, 5
   × 10ⁿ), environ quatre intervalles.
========================= */

export interface NiceScale {
  min: number;
  max: number;
  ticks: number[];
}

function niceStep(
  range: number
): number {
  const rough =
    range / 4;

  const power =
    10 ** Math.floor(Math.log10(rough));

  const fraction =
    rough / power;

  const nice =
    fraction <= 1 ? 1 :
    fraction <= 2 ? 2 :
    fraction <= 2.5 ? 2.5 :
    fraction <= 5 ? 5 : 10;

  return nice * power;
}

/*
  includeZero : le zéro fait partie du domaine (barres) ;
  sinon le domaine suit les valeurs (cours).
*/
export function niceScale(
  values: number[],
  includeZero: boolean
): NiceScale {
  const known =
    values.filter(Number.isFinite);

  let rawMin =
    known.length ? Math.min(...known) : 0;

  let rawMax =
    known.length ? Math.max(...known) : 1;

  if (includeZero) {
    rawMin = Math.min(0, rawMin);
    rawMax = Math.max(0, rawMax);
  }

  if (rawMin === rawMax) {
    const pad =
      Math.abs(rawMin) * 0.05 || 1;

    rawMin -= pad;
    rawMax += pad;
  }

  const step =
    niceStep(rawMax - rawMin);

  const min =
    Math.floor(rawMin / step) * step;

  const max =
    Math.ceil(rawMax / step) * step;

  const ticks: number[] = [];

  for (
    let tick = min;
    tick <= max + step / 2;
    tick += step
  ) {
    ticks.push(
      Number(tick.toFixed(10))
    );
  }

  return { min, max, ticks };
}
