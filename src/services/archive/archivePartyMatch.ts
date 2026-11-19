import {
  isStandardParty,
  type Party,
} from "@/contracts/parties";

/* =========================
   Relation déduite d'un texte

   Pour un document déposé dans « A Classer » sous un nom
   libre (« wingo-2026-10-31-424004400.pdf ») : parties dont
   le libellé ou un alias apparaît dans le texte, en mots
   entiers, sans casse ni accents (« Wingo », alias de
   « Swisscom & Wingo »).

   - Parties génériques, réservées et dossiers d'archives
     écartés ; noms de moins de trois lettres ou chiffres
     écartés (« C&A »).
   - Classement : nom le plus long d'abord, puis partie la
     plus utilisée dans les archives.
========================= */

const MIN_NAME_LENGTH =
  3;

/* Minuscules sans accents, mots séparés par une espace. */
function normalizeWords(
  text: string
): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function matchPartiesInText(
  text: string,
  parties: readonly Party[]
): Party[] {
  const haystack =
    ` ${normalizeWords(text)} `;

  if (!haystack.trim()) {
    return [];
  }

  const matches: { party: Party; length: number }[] = [];

  for (const party of parties) {
    if (!isStandardParty(party) || party.generic) {
      continue;
    }

    let longest = 0;

    for (const name of [party.label, ...party.aliases]) {
      const words =
        normalizeWords(name);

      if (
        words.replace(/ /g, "").length >= MIN_NAME_LENGTH &&
        haystack.includes(` ${words} `)
      ) {
        longest =
          Math.max(longest, words.length);
      }
    }

    if (longest > 0) {
      matches.push({ party, length: longest });
    }
  }

  return matches
    .sort((a, b) =>
      b.length - a.length ||
      b.party.usage.archives - a.party.usage.archives
    )
    .map(match => match.party);
}
