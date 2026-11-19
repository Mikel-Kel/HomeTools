import {
  computed,
  watch,
  type Ref,
} from "vue";

import { usePersistentRef } from "@/composables/usePersistentRef";
import { useArchivePayDates } from "@/composables/archives/useArchivePayDates";

import {
  TO_FILE_FOLDER,
  type ArchiveItem,
} from "@/contracts/archive";

/* =========================
   Filtres de la page Documents

   Dossier (null : All), sous-dossier (Tourism, Various),
   date de paiement et trimestre (Bills), tags et recherche
   (partie, Description, Additional info), gardés en
   session (usePersistentRef « archives.* »).
   Documents filtrés triés du plus récent au plus ancien.

   Options :
   - items : documents chargés (useArchiveDocuments) ;
   - billsFolderSource : nom du dossier des factures ;
   - defaultFolder : dossier proposé au premier chargement
     et par Reset ;
   - partyLabel : libellé d'une partie, pour la recherche.
========================= */

export interface ArchiveFiltersOptions {
  items: Ref<ArchiveItem[]>;
  billsFolderSource: Ref<string | null>;
  defaultFolder: Ref<string | null>;
  partyLabel: (partyID: number) => string;
}

export function useArchiveFilters(
  options: ArchiveFiltersOptions
) {
  const {
    items,
  } = options;

  /* null : All. */
  const selectedFolder =
    usePersistentRef<string | null>("archives.selectedFolder", null);

  /*
    Dossier par défaut déjà appliqué dans la session : un
    « All » choisi ensuite n'est plus remplacé.
  */
  const folderChosen =
    usePersistentRef("archives.folderChosen", false);

  function applyDefaultFolder() {
    if (folderChosen.value) {
      return;
    }

    selectedFolder.value =
      selectedFolder.value ??
      options.defaultFolder.value;

    folderChosen.value =
      selectedFolder.value !== null;
  }

  const selectedSubFolder =
    usePersistentRef<number | null>("archives.selectedSubFolder", null);

  const selectedDTADate =
    usePersistentRef<string | null>("archives.selectedDTADate", null);

  const selectedTags =
    usePersistentRef<number[]>("archives.selectedTags", []);

  const searchText =
    usePersistentRef("archives.searchText", "");

  const selectedQuarterOffset =
    usePersistentRef("archives.selectedQuarterOffset", 0);

  /* Dossier des factures choisi : dates de paiement et tags propres. */
  const isBillsSelected =
    computed(() =>
      selectedFolder.value ===
      options.billsFolderSource.value
    );

  /* =========================
     Pay dates
  ========================= */

  const {
    activeQuarterKey,
    payDatesInActiveQuarter,
    selectDefaultPayDateForQuarter,
  } = useArchivePayDates({
    items,
    quarterOffset: selectedQuarterOffset,
    selectedDate: selectedDTADate,
  });

  /* =========================
     Tag filters
  ========================= */

  function toggleFilterTag(
    id: number
  ) {
    const index =
      selectedTags.value.indexOf(
        id
      );

    if (index >= 0) {
      selectedTags.value.splice(
        index,
        1
      );
    } else {
      selectedTags.value.push(
        id
      );

      /* Choisir un tag depuis « To file » : recherche dans tous les dossiers (All). */
      if (
        selectedFolder.value ===
        TO_FILE_FOLDER
      ) {
        selectedFolder.value =
          null;
      }
    }
  }

  /* =========================
     Filtering
  ========================= */

  function resetFilters() {
    selectedFolder.value =
      options.defaultFolder.value;

    selectedSubFolder.value =
      null;

    selectedDTADate.value =
      null;

    selectedTags.value =
      [];

    searchText.value =
      "";

    selectedQuarterOffset.value =
      0;

    if (
      selectedFolder.value ===
      options.billsFolderSource.value
    ) {
      selectDefaultPayDateForQuarter();
    }
  }

  const filteredItems =
    computed(() => {
      return items.value
        .filter(item => {
          if (
            selectedFolder.value &&
            item.folder !==
              selectedFolder.value
          ) {
            return false;
          }

          if (
            selectedSubFolder.value &&
            item.partyID !==
              selectedSubFolder.value
          ) {
            return false;
          }

          if (
            isBillsSelected.value &&
            selectedDTADate.value &&
            item.dtaDate !==
              selectedDTADate.value
          ) {
            return false;
          }

          const query =
            searchText.value
              .trim()
              .toLowerCase();

          if (query) {
            const party =
              options.partyLabel(
                item.partyID
              ).toLowerCase();

            const info1 =
              item.info1
                ?.toLowerCase() ??
              "";

            const info2 =
              item.info2
                ?.toLowerCase() ??
              "";

            if (
              !party.includes(
                query
              ) &&
              !info1.includes(
                query
              ) &&
              !info2.includes(
                query
              )
            ) {
              return false;
            }
          }

          const itemTags =
            item.tagIDs ?? [];

          if (
            isBillsSelected.value
          ) {
            if (
              selectedTags.value
                .length === 0
            ) {
              if (
                itemTags.includes(7)
              ) {
                return false;
              }

            } else {
              const hasMatch =
                selectedTags.value
                  .some(
                    tagID =>
                      itemTags.includes(
                        tagID
                      )
                  );

              if (!hasMatch) {
                return false;
              }
            }

          } else if (
            selectedTags.value
              .length > 0
          ) {
            const hasMatch =
              selectedTags.value
                .some(
                  tagID =>
                    itemTags.includes(
                      tagID
                    )
                );

            if (!hasMatch) {
              return false;
            }
          }

          return true;
        })
        .sort(
          (a, b) =>
            b.documentDate
              .localeCompare(
                a.documentDate
              )
        );
    });


  /* =========================
     Folder watcher
  ========================= */

  watch(
    selectedFolder,
    value => {
      selectedSubFolder.value =
        null;

      if (
        value ===
        options.billsFolderSource.value
      ) {
        selectedTags.value =
          [];

        selectedQuarterOffset.value =
          0;

        selectDefaultPayDateForQuarter();

      } else {
        selectedDTADate.value =
          null;
      }
    }
  );

  return {
    selectedFolder,
    folderChosen,
    applyDefaultFolder,
    selectedSubFolder,
    selectedDTADate,
    selectedTags,
    searchText,
    selectedQuarterOffset,
    isBillsSelected,
    activeQuarterKey,
    payDatesInActiveQuarter,
    selectDefaultPayDateForQuarter,
    toggleFilterTag,
    resetFilters,
    filteredItems,
  };
}
