import type {
  IndicatorItem,
  IndicatorValue,
} from "@/contracts/indicators";

/* =========================
   Historique d'un indicateur

   Indicateur cumulatif (compteur) : la valeur d'un mois est
   sa consommation (relevé moins le relevé précédent, ou
   moins la valeur initiale du relevé) ; un trimestre en est
   la somme.
   Indicateur non cumulatif (température, humidité, pluie) :
   la valeur d'un mois est le relevé ; un trimestre en est la
   moyenne.
   « AVG » : moyenne des mois (ou des trimestres) renseignés
   de l'année.
========================= */

export type MonthlyValues = (number | null)[];

function average(
  values: (number | null)[]
): number | null {
  const known =
    values.filter(
      (value): value is number => value !== null
    );

  return known.length
    ? known.reduce((sum, value) => sum + value, 0) /
        known.length
    : null;
}

function sum(
  values: (number | null)[]
): number | null {
  const known =
    values.filter(
      (value): value is number => value !== null
    );

  return known.length
    ? known.reduce((total, value) => total + value, 0)
    : null;
}

/*
  Valeurs mensuelles (janvier à décembre) de chaque année
  demandée. values : relevés de l'indicateur, du plus
  ancien au plus récent.
*/
export function monthlyValuesByYear(
  item: IndicatorItem,
  values: IndicatorValue[],
  years: number[]
): Map<number, MonthlyValues> {
  const result =
    new Map<number, MonthlyValues>(
      years.map(year => [year, Array(12).fill(null)])
    );

  values.forEach(
    (reading, index) => {
      const year =
        Number(reading.date.slice(0, 4));

      const months =
        result.get(year);

      if (!months) {
        return;
      }

      const month =
        Number(reading.date.slice(5, 7)) - 1;

      if (!item.cumulative) {
        months[month] = reading.value;
        return;
      }

      const base =
        reading.initialValue ??
        values[index - 1]?.value ??
        null;

      months[month] =
        base === null
          ? null
          : reading.value - base;
    }
  );

  return result;
}

export function yearAverage(
  values: (number | null)[]
): number | null {
  return average(values);
}

export function quarterValues(
  item: IndicatorItem,
  months: MonthlyValues
): (number | null)[] {
  return [0, 1, 2, 3].map(
    quarter => {
      const slice =
        months.slice(quarter * 3, quarter * 3 + 3);

      return item.cumulative
        ? sum(slice)
        : average(slice);
    }
  );
}
