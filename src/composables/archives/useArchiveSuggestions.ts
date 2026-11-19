import {
  computed,
  type Ref,
} from "vue";

import {
  renderArchiveTemplate,
  toArchiveTemplate,
} from "@/services/archive/archiveTemplates";

import {
  TO_FILE_FOLDER,
  type ArchiveItem,
} from "@/contracts/archive";

/* =========================
   Suggestions de Description et d'Additional info

   Tirées de l'historique des classements déjà chargé (tous
   les documents classés, hors « A Classer »), sans règle ni
   échange avec le Mac. En deux temps :
   - descriptionsFor : Descriptions les plus probables ;
   - additionalInfosFor : Additional info les plus probables,
     parmi les documents qui avaient la Description donnée
     (tous ceux de l'historique si aucun ne l'avait) ;
   - foldersFor : dossiers habituels de la partie, du plus
     probable au moins probable (mêmes poids).

   - Historique : documents du même dossier et de la même
     partie (ou sous-dossier Tourism / Various) ; s'il n'y
     en a aucun, documents de la même partie dans tous les
     dossiers.
   - Textes ramenés à un modèle (archiveTemplates.ts), rendu
     pour la date du document à classer : « 2026-06 » d'une
     facture de juillet devient « 2026-09 » pour une facture
     d'octobre.
   - Score d'un texte : somme, sur les documents, de la
     récence (0,5 ^ (âge en mois / 12)) × la saison (1,5 si
     le mois de l'année est le même à un mois près).

   Mesure (Home, 2026-11-19 : 675 classements depuis
   2024-11 ayant un historique, rejoués avec l'historique
   antérieur seulement) : Description juste en tête 35 %,
   dans les trois premières 59 % ; Additional info, sachant
   la Description, 42 % et 59 %.
========================= */

export interface ArchiveSuggestionTarget {
  tocid: number;
  folder: string;
  partyID: number;
  documentDate: string;
}

export interface ArchiveSuggestion {
  text: string;

  /* Nombre de documents classés ainsi. */
  count: number;

  /* Part du score du texte dans celui de l'historique (0 à 1). */
  confidence: number;
}

interface HistoryEntry {
  tocid: number;
  folder: string;
  info1Template: string;
  info2Template: string;
  year: number;
  month: number;
}

interface YearMonth {
  year: number;
  month: number;
}

const DEFAULT_LIMIT =
  3;

function historyKey(
  folder: string,
  partyID: number
): string {
  return `${folder}|${partyID}`;
}

function yearMonth(
  date: string
): YearMonth | null {
  const match =
    /^(\d{4})-(\d{2})/.exec(date);

  return match
    ? { year: Number(match[1]), month: Number(match[2]) }
    : null;
}

/* Poids d'un document passé pour un document daté de target. */
function weight(
  entry: HistoryEntry,
  target: YearMonth
): number {
  const ageMonths =
    Math.abs((target.year - entry.year) * 12 + target.month - entry.month);

  const monthGap =
    Math.abs(target.month - entry.month);

  const sameSeason =
    monthGap <= 1 || monthGap === 11;

  return 0.5 ** (ageMonths / 12) * (sameSeason ? 1.5 : 1);
}

/*
  Textes les plus probables : modèles regroupés, classés par
  score, rendus pour la date du document ; vides écartés,
  deux modèles au même rendu n'en font qu'un.
*/
function rank(
  entries: HistoryEntry[],
  templateOf: (entry: HistoryEntry) => string,
  target: ArchiveSuggestionTarget,
  date: YearMonth,
  limit: number
): ArchiveSuggestion[] {
  const scores =
    new Map<string, { score: number; count: number }>();

  let total = 0;

  for (const entry of entries) {
    const score =
      weight(entry, date);

    const template =
      templateOf(entry);

    const current =
      scores.get(template) ?? { score: 0, count: 0 };

    current.score += score;
    current.count += 1;
    scores.set(template, current);
    total += score;
  }

  const suggestions: ArchiveSuggestion[] = [];

  for (
    const [template, { score, count }]
    of [...scores.entries()].sort((a, b) => b[1].score - a[1].score)
  ) {
    const text =
      renderArchiveTemplate(template, target.documentDate).trim();

    if (!text || suggestions.some(item => item.text === text)) {
      continue;
    }

    suggestions.push({
      text,
      count,
      confidence: total > 0 ? score / total : 0,
    });

    if (suggestions.length === limit) {
      break;
    }
  }

  return suggestions;
}

export function useArchiveSuggestions(
  items: Ref<ArchiveItem[]>
) {
  /* Historique par dossier et partie, et par partie seule. */
  const history =
    computed(() => {
      const byFolder =
        new Map<string, HistoryEntry[]>();

      const byParty =
        new Map<number, HistoryEntry[]>();

      for (const item of items.value) {
        const date =
          yearMonth(item.documentDate);

        if (
          !date ||
          item.folder === TO_FILE_FOLDER ||
          item.partyID <= 0 ||
          (!item.info1 && !item.info2)
        ) {
          continue;
        }

        const entry: HistoryEntry = {
          tocid: item.tocid,
          folder: item.folder,
          info1Template: toArchiveTemplate(item.info1, item.documentDate),
          info2Template: toArchiveTemplate(item.info2, item.documentDate),
          ...date,
        };

        const key =
          historyKey(item.folder, item.partyID);

        if (!byFolder.has(key)) {
          byFolder.set(key, []);
        }

        if (!byParty.has(item.partyID)) {
          byParty.set(item.partyID, []);
        }

        byFolder.get(key)!.push(entry);
        byParty.get(item.partyID)!.push(entry);
      }

      return {
        byFolder,
        byParty,
      };
    });

  /* Historique utile au document (lui-même exclu) ; vide sans partie ni date. */
  function entriesFor(
    target: ArchiveSuggestionTarget
  ): HistoryEntry[] {
    if (target.partyID <= 0) {
      return [];
    }

    const sameFolder =
      history.value.byFolder.get(historyKey(target.folder, target.partyID)) ?? [];

    return (
      sameFolder.length
        ? sameFolder
        : history.value.byParty.get(target.partyID) ?? []
    ).filter(entry => entry.tocid !== target.tocid);
  }

  function descriptionsFor(
    target: ArchiveSuggestionTarget,
    limit = DEFAULT_LIMIT
  ): ArchiveSuggestion[] {
    const date =
      yearMonth(target.documentDate);

    return date
      ? rank(entriesFor(target), entry => entry.info1Template, target, date, limit)
      : [];
  }

  function additionalInfosFor(
    target: ArchiveSuggestionTarget,
    info1: string,
    limit = DEFAULT_LIMIT
  ): ArchiveSuggestion[] {
    const date =
      yearMonth(target.documentDate);

    if (!date) {
      return [];
    }

    const entries =
      entriesFor(target);

    const info1Template =
      toArchiveTemplate(info1.trim(), target.documentDate);

    const sameDescription =
      entries.filter(entry => entry.info1Template.trim() === info1Template);

    return rank(
      sameDescription.length ? sameDescription : entries,
      entry => entry.info2Template,
      target,
      date,
      limit
    );
  }

  function foldersFor(
    target: ArchiveSuggestionTarget
  ): string[] {
    const date =
      yearMonth(target.documentDate);

    if (!date || target.partyID <= 0) {
      return [];
    }

    const scores =
      new Map<string, number>();

    for (
      const entry
      of history.value.byParty.get(target.partyID) ?? []
    ) {
      if (entry.tocid !== target.tocid) {
        scores.set(entry.folder, (scores.get(entry.folder) ?? 0) + weight(entry, date));
      }
    }

    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([folder]) => folder);
  }

  return {
    descriptionsFor,
    additionalInfosFor,
    foldersFor,
  };
}

/* Ce que la fiche de classement reçoit. */
export type ArchiveSuggestionSource =
  ReturnType<typeof useArchiveSuggestions>;
