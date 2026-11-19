/* =========================
   Modèles de Description et d'Additional info

   Un texte de classement passé est ramené à un modèle dont
   les périodes sont relatives à la date du document, puis
   rendu pour la date d'un autre document :

   | Dans le texte (document de 2026-07) | Jeton    | Rendu pour 2026-10 |
   |-------------------------------------|----------|--------------------|
   | 2026-06                             | {M-1}    | 2026-09            |
   | 2026-Q2                             | {QH-1}   | 2026-Q3            |
   | 2026 Q2                             | {Q-1}    | 2026 Q3            |
   | 2026-2027                           | {Y}-{Y+1}  | 2026-2027        |
   | 2025-26                             | {Y-1}-{YY} | 2025-26          |
   | 2026                                | {Y}      | 2026               |

   Seules les années de 1990 à 2099 à neuf ans au plus de
   la date du document sont converties ; un nombre collé à
   un point ou à d'autres chiffres (numéros de police,
   « 88.618.418 ») ne l'est jamais. Mêmes principes que les
   jetons des règles d'allocation (allocation-rules-contract
   § 3, § 10.2), dans une forme propre aux archives (« 2026-Q2 »,
   écriture des archives) : les modèles ne sont ni stockés
   ni échangés avec le Mac.
========================= */

type TokenKind = "M" | "Q" | "QH" | "Y" | "YY";

const TOKEN_PATTERN =
  /\{(QH|YY|M|Q|Y)([+-]\d{1,3})?\}/g;

const MAX_YEAR_OFFSET =
  9;

interface YearMonth {
  year: number;
  month: number;
}

function parseDate(
  date: string
): YearMonth | null {
  const match =
    /^(\d{4})-(\d{2})/.exec(date);

  return match
    ? { year: Number(match[1]), month: Number(match[2]) }
    : null;
}

function token(
  kind: TokenKind,
  offset: number
): string {
  if (offset === 0) {
    return `{${kind}}`;
  }

  return `{${kind}${offset > 0 ? "+" : ""}${offset}}`;
}

function quarterIndex(
  year: number,
  quarter: number
): number {
  return year * 4 + (quarter - 1);
}

/* Année plausible d'un document daté de reference. */
function isNearYear(
  year: number,
  reference: number
): boolean {
  return (
    year >= 1990 &&
    year <= 2099 &&
    Math.abs(year - reference) <= MAX_YEAR_OFFSET
  );
}

/*
  Limites d'un nombre isolé : ni chiffre ni point juste
  avant ou juste après.
*/
const BEFORE =
  "(?<![\\d.])";

const AFTER =
  "(?![\\d.])";

/* Texte → modèle, relativement à la date du document (AAAA-MM-JJ). */
export function toArchiveTemplate(
  text: string,
  documentDate: string
): string {
  const reference =
    parseDate(documentDate);

  if (!reference || !text) {
    return text;
  }

  const { year, month } =
    reference;

  const currentQuarter =
    quarterIndex(year, Math.floor((month - 1) / 3) + 1);

  let template =
    text;

  /* AAAA-MM (mois 01 à 12). */
  template = template.replace(
    new RegExp(`${BEFORE}(\\d{4})-(0[1-9]|1[0-2])${AFTER}`, "g"),
    (match, y: string, m: string) =>
      isNearYear(Number(y), year)
        ? token("M", (Number(y) - year) * 12 + Number(m) - month)
        : match
  );

  /* AAAA-Qn et AAAA Qn. */
  template = template.replace(
    new RegExp(`${BEFORE}(\\d{4})([- ])Q([1-4])${AFTER}`, "g"),
    (match, y: string, separator: string, q: string) =>
      isNearYear(Number(y), year)
        ? token(
            separator === "-" ? "QH" : "Q",
            quarterIndex(Number(y), Number(q)) - currentQuarter
          )
        : match
  );

  /* AAAA-AAAA et AAAA-AA, années qui se suivent. */
  template = template.replace(
    new RegExp(`${BEFORE}(\\d{4})-(\\d{4}|\\d{2})${AFTER}`, "g"),
    (match, first: string, second: string) => {
      const start =
        Number(first);

      const end =
        second.length === 4
          ? Number(second)
          : Math.floor(start / 100) * 100 + Number(second);

      if (end !== start + 1 || !isNearYear(start, year)) {
        return match;
      }

      return second.length === 4
        ? `${token("Y", start - year)}-${token("Y", end - year)}`
        : `${token("Y", start - year)}-${token("YY", end - year)}`;
    }
  );

  /* AAAA seul. */
  template = template.replace(
    new RegExp(`${BEFORE}(\\d{4})${AFTER}`, "g"),
    (match, y: string) =>
      isNearYear(Number(y), year)
        ? token("Y", Number(y) - year)
        : match
  );

  return template;
}

function renderToken(
  kind: TokenKind,
  offset: number,
  reference: YearMonth
): string {
  switch (kind) {
    case "M": {
      const index =
        reference.year * 12 + (reference.month - 1) + offset;

      return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
    }

    case "Q":
    case "QH": {
      const index =
        quarterIndex(reference.year, Math.floor((reference.month - 1) / 3) + 1) + offset;

      return `${Math.floor(index / 4)}${kind === "QH" ? "-" : " "}Q${(index % 4) + 1}`;
    }

    case "Y":
      return String(reference.year + offset);

    case "YY":
      return String((reference.year + offset) % 100).padStart(2, "0");
  }
}

/* Modèle → texte pour la date d'un document (AAAA-MM-JJ). */
export function renderArchiveTemplate(
  template: string,
  documentDate: string
): string {
  const reference =
    parseDate(documentDate);

  if (!reference) {
    return template;
  }

  return template.replace(
    TOKEN_PATTERN,
    (_match, kind: TokenKind, offset?: string) =>
      renderToken(kind, offset ? Number(offset) : 0, reference)
  );
}
