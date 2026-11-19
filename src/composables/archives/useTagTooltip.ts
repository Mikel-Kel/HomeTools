import { ref } from "vue";

import { useDocumentTags } from "@/composables/archives/useDocumentTags";

/* =========================
   Info-bulle des tags de documents

   Nom du tag survolé, au-dessus de sa pastille, masqué
   après 2 s ou à la sortie du pointeur. État partagé
   (module) : une seule info-bulle pour les filtres et le
   tableau de la page Documents, affichée par TagTooltip.vue.
========================= */

export interface TagTooltipState {
  text: string;
  x: number;
  y: number;
}

const tooltip =
  ref<TagTooltipState | null>(null);

let tooltipTimer:
  ReturnType<typeof setTimeout> | null =
  null;

const DISPLAY_MS =
  2000;

function clearTimer() {
  if (tooltipTimer) {
    clearTimeout(tooltipTimer);
    tooltipTimer = null;
  }
}

export function useTagTooltip() {
  const tagsStore =
    useDocumentTags();

  function showTagTooltip(
    event: MouseEvent,
    tagID: number
  ) {
    const tag =
      tagsStore.tags.value.find(
        item => item.id === tagID
      );

    if (!tag) {
      return;
    }

    const rect =
      (event.currentTarget as HTMLElement)
        .getBoundingClientRect();

    tooltip.value = {
      text:
        tag.tagName,

      x:
        rect.left +
        rect.width / 2,

      y:
        rect.top - 8,
    };

    clearTimer();

    tooltipTimer =
      setTimeout(
        () => {
          tooltip.value = null;
          tooltipTimer = null;
        },
        DISPLAY_MS
      );
  }

  function hideTagTooltip() {
    clearTimer();
    tooltip.value = null;
  }

  return {
    tooltip,
    showTagTooltip,
    hideTagTooltip,
  };
}
