import {
  onBeforeUnmount,
  ref,
} from "vue";

/* =========================
   Bulle de mémo au survol

   Avec une souris seulement (Mac) : l'iPad n'a pas de
   survol, le mémo s'y ouvre au toucher. La bulle apparaît
   après un court délai sous l'élément survolé ; elle est
   affichée par MemoTooltip.vue.
========================= */

const SHOW_DELAY_MS = 500;

export interface MemoTooltipState {
  memo: string;
  top: number;
  left: number;
}

export function useMemoTooltip() {
  const tooltip =
    ref<MemoTooltipState | null>(null);

  const canHover =
    window.matchMedia(
      "(hover: hover) and (pointer: fine)"
    ).matches;

  let timer:
    number | null = null;

  function clearTimer() {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  }

  function show(
    event: MouseEvent,
    memo: string | null | undefined
  ) {
    clearTimer();

    if (!canHover || !memo) {
      return;
    }

    const target =
      event.currentTarget as HTMLElement;

    timer =
      window.setTimeout(
        () => {
          const rect =
            target.getBoundingClientRect();

          tooltip.value = {
            memo,
            top: rect.bottom + 6,
            left: rect.left,
          };
        },
        SHOW_DELAY_MS
      );
  }

  function hide() {
    clearTimer();

    tooltip.value =
      null;
  }

  onBeforeUnmount(clearTimer);

  return {
    tooltip,
    show,
    hide,
  };
}
