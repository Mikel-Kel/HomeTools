import { ref } from "vue";

import {
  listFiles,
  loadJSONFromFolder,
} from "@/services/driveAdapter";

import {
  asArray,
  asNullableNumber,
  asObject,
  asString,
} from "@/contracts/read";

/* =========================
   Dernières allocations saisies (« Same as last »)

   Tirées du stockage, quel que soit l'appareil : les lignes
   des drafts de allocations/drafts/ (savedAt écrit par la
   PWA), hors celui du mouvement ouvert, de la plus récente à
   la plus ancienne (drafts par savedAt, lignes d'un draft de
   la dernière à la première). Une ligne identique à une plus
   récente pour les caractéristiques reprises est écartée.
   Les drafts disparaissent à la release : rien à proposer
   ensuite jusqu'à la prochaine allocation.

   Seuls catégorie, sous-catégorie, tag et commentaire sont
   repris ; ni montant, ni partie, ni date d'allocation.
========================= */

const DRAFTS_FOLDER = "allocations/drafts";

export interface LastAllocation {
  spendingId: string;
  savedAt: string;
  categoryID: number;
  subCategoryID: number;
  allocatedTagID: number | null;
  comment: string;
}

/* Lignes complètes d'un draft, de la dernière à la première. */
function readLines(
  raw: unknown
): LastAllocation[] {
  const draft =
    asObject(raw);

  if (!draft) {
    return [];
  }

  const spendingId =
    asString(draft.spendingId);

  const savedAt =
    asString(draft.savedAt);

  return asArray(draft.allocations)
    .map(asObject)
    .reverse()
    .flatMap(line => {
      const categoryID =
        asNullableNumber(line?.categoryID);

      const subCategoryID =
        asNullableNumber(line?.subCategoryID);

      if (!line || categoryID === null || subCategoryID === null) {
        return [];
      }

      return [{
        spendingId,
        savedAt,
        categoryID,
        subCategoryID,
        allocatedTagID: asNullableNumber(line.allocatedTagID) || null,
        comment: asString(line.comment),
      }];
    });
}

/* Clé des caractéristiques reprises. */
function characteristicsKey(
  line: LastAllocation
): string {
  return JSON.stringify([
    line.categoryID,
    line.subCategoryID,
    line.allocatedTagID,
    line.comment,
  ]);
}

export function useLastAllocation() {
  /* Allocations distinctes, de la plus récente à la plus ancienne. */
  const recent =
    ref<LastAllocation[]>([]);

  /* Lecture de tous les drafts sauf celui du mouvement ouvert ; un draft illisible est ignoré. */
  async function load(
    currentSpendingId: string
  ) {
    try {
      const files =
        (await listFiles(DRAFTS_FOLDER))
          .filter(
            file =>
              file.name.endsWith(".json") &&
              file.name !== `${currentSpendingId}.json`
          );

      const drafts =
        await Promise.all(
          files.map(file =>
            loadJSONFromFolder(DRAFTS_FOLDER, file.name)
              .then(readLines)
              .catch(() => [])
          )
        );

      const seen =
        new Set<string>();

      recent.value =
        drafts
          .filter(lines => lines.length > 0 && !!lines[0].savedAt)
          .sort((a, b) => b[0].savedAt.localeCompare(a[0].savedAt))
          .flat()
          .filter(line => {
            const key =
              characteristicsKey(line);

            if (seen.has(key)) {
              return false;
            }

            seen.add(key);
            return true;
          });

    } catch (err) {
      console.warn("Unable to read the last allocations", err);
      recent.value = [];
    }
  }

  return {
    recent,
    load,
  };
}
