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
   Dernière allocation saisie (« Same as last »)

   Tirée du stockage, quel que soit l'appareil : le draft le
   plus récent de allocations/drafts/ (savedAt écrit par la
   PWA), hors celui du mouvement ouvert, et sa dernière ligne.
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

/* Dernière ligne d'un draft, ou null s'il n'en a pas de complète. */
function readLastLine(
  raw: unknown
): LastAllocation | null {
  const draft =
    asObject(raw);

  if (!draft) {
    return null;
  }

  const line =
    asObject(asArray(draft.allocations).at(-1));

  const categoryID =
    asNullableNumber(line?.categoryID);

  const subCategoryID =
    asNullableNumber(line?.subCategoryID);

  if (!line || categoryID === null || subCategoryID === null) {
    return null;
  }

  return {
    spendingId: asString(draft.spendingId),
    savedAt: asString(draft.savedAt),
    categoryID,
    subCategoryID,
    allocatedTagID: asNullableNumber(line.allocatedTagID) || null,
    comment: asString(line.comment),
  };
}

export function useLastAllocation() {
  const last =
    ref<LastAllocation | null>(null);

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

      const lines =
        await Promise.all(
          files.map(file =>
            loadJSONFromFolder(DRAFTS_FOLDER, file.name)
              .then(readLastLine)
              .catch(() => null)
          )
        );

      last.value =
        lines
          .filter((line): line is LastAllocation => line !== null && !!line.savedAt)
          .reduce<LastAllocation | null>(
            (newest, line) =>
              !newest || line.savedAt > newest.savedAt ? line : newest,
            null
          );

    } catch (err) {
      console.warn("Unable to read the last allocation", err);
      last.value = null;
    }
  }

  return {
    last,
    load,
  };
}
