import type { Ref } from "vue";

import { emitEvent } from "@/services/events/eventFiles";
import { buildPhysicalName } from "@/services/archive/archiveNaming";

import type { ArchiveItem } from "@/contracts/archive";

/* =========================
   Classement et suppression d'un document

   Événements events/PWA-TOC_<AAAAMMJJHHMMSS>_<TOCID>.json,
   traités par processEvent_TOC sur le Mac, sans suivi de
   statut :
   - ARCHIVE_UPDATED : nouveau nom physique et métadonnées ;
     le document est mis à jour tout de suite dans items,
     sous son nouveau nom (ouverture, nouveau classement
     avant la relecture : le Mac traite les événements dans
     l'ordre), et remis dans son état précédent si l'envoi
     échoue ;
   - ARCHIVE_DELETED : pas de retrait anticipé.
   Dans les deux cas, l'index republié par le Mac recharge
   ensuite les fichiers concernés (useArchiveDocuments) :
   pas de relecture immédiate, qui ramènerait un instant
   l'état d'avant.

   save et remove renvoient null, ou la raison de l'échec.
========================= */

export interface ArchiveClassificationOptions {
  items: Ref<ArchiveItem[]>;
  partyLabel: (partyID: number) => string;
}

function failure(
  err: unknown,
  fallback: string
): string {
  return err instanceof Error
    ? err.message
    : fallback;
}

export function useArchiveClassification(
  options: ArchiveClassificationOptions
) {
  const {
    items,
  } = options;

  /* Remplace le document de même tocid, s'il est chargé. */
  function replaceItem(
    item: ArchiveItem
  ) {
    const index =
      items.value.findIndex(
        current =>
          current.tocid ===
          item.tocid
      );

    if (index !== -1) {
      items.value[index] = {
        ...item,
      };
    }
  }

  async function save(
    updated: ArchiveItem
  ): Promise<string | null> {
    const previousItem =
      items.value.find(
        item =>
          item.tocid ===
          updated.tocid
      );

    const previousSnapshot =
      previousItem
        ? { ...previousItem }
        : null;

    const newPhysicalName =
      buildPhysicalName(
        updated,
        options.partyLabel
      );

    try {
      replaceItem({
        ...updated,
        physicalName: newPhysicalName,
      });

      const event = {
        eventType:
          "ARCHIVE_UPDATED",

        version:
          1,

        timestamp:
          new Date().toISOString(),

        processedFile:
          updated.physicalName,

        archiveMetadata: {
          tocid:
            updated.tocid,

          newPhysicalName,

          folder:
            updated.folder,

          partyID:
            updated.partyID,

          documentDate:
            updated.documentDate,

          dtaDate:
            updated.dtaDate,

          info1:
            updated.info1,

          info2:
            updated.info2,

          refAmount:
            updated.refAmount,

          tagIDs:
            updated.tagIDs ??
            [],
        },
      };

      await emitEvent(
        "TOC",
        event,
        String(updated.tocid)
      );

      return null;

    } catch (err) {
      console.error(
        "Archive classification save failed",
        err
      );

      if (previousSnapshot) {
        replaceItem(previousSnapshot);
      }

      return failure(err, "Save failed");
    }
  }

  async function remove(
    tocid: number
  ): Promise<string | null> {
    try {
      const event = {
        eventType:
          "ARCHIVE_DELETED",

        version:
          1,

        timestamp:
          new Date().toISOString(),

        archiveMetadata: {
          tocid,
        },
      };

      await emitEvent(
        "TOC",
        event,
        String(tocid)
      );

      return null;

    } catch (err) {
      console.error(
        "Archive deletion request failed",
        err
      );

      return failure(err, "Delete failed");
    }
  }

  return {
    save,
    remove,
  };
}
