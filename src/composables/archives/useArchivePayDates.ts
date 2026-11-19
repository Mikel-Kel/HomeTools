import {
  computed,
  watch,
  type Ref,
} from "vue";

import type { ArchiveItem } from "@/contracts/archive";

/* =========================
   Dates de paiement des factures (Bills)

   Dates DTA des documents chargés, regroupées par
   trimestre (« 2026 Q4 »), la plus récente d'abord.
   Trimestre affiché : le trimestre courant (ou le plus
   récent qui a des dates) décalé de quarterOffset ; hors
   limites, le trimestre de départ.

   Date proposée (selectDefaultPayDateForQuarter) : celle
   déjà choisie si elle est dans le trimestre ; sinon, pour
   le trimestre courant, la prochaine date à venir (ou la
   dernière), et la plus récente pour un autre trimestre.
   Rappelée à chaque changement de trimestre.
========================= */

export interface ArchivePayDatesOptions {
  items: Ref<ArchiveItem[]>;
  quarterOffset: Ref<number>;
  selectedDate: Ref<string | null>;
}

function getQuarterKey(
  dateString: string
): string {
  const [
    year,
    month,
  ] =
    dateString
      .split("-")
      .map(Number);

  const quarter =
    Math.floor(
      (month - 1) / 3
    ) + 1;

  return (
    `${year} Q${quarter}`
  );
}

function getCurrentQuarterKey():
  string {
  const now =
    new Date();

  const quarter =
    Math.floor(
      now.getMonth() / 3
    ) + 1;

  return (
    `${now.getFullYear()} Q${quarter}`
  );
}

function todayISO():
  string {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

export function useArchivePayDates(
  options: ArchivePayDatesOptions
) {
  const payDatesByQuarter =
    computed(() => {
      const map =
        new Map<
          string,
          string[]
        >();

      for (
        const item
        of options.items.value
      ) {
        if (!item.dtaDate) {
          continue;
        }

        const key =
          getQuarterKey(
            item.dtaDate
          );

        if (!map.has(key)) {
          map.set(
            key,
            []
          );
        }

        map.get(key)!
          .push(
            item.dtaDate
          );
      }

      for (
        const [
          key,
          dates,
        ]
        of map
      ) {
        const unique =
          [
            ...new Set(
              dates
            ),
          ];

        unique.sort(
          (a, b) =>
            b.localeCompare(a)
        );

        map.set(
          key,
          unique
        );
      }

      return map;
    });

  const availableQuarters =
    computed(() =>
      [
        ...payDatesByQuarter
          .value
          .keys(),
      ]
        .sort()
        .reverse()
    );

  const activeQuarterIndex =
    computed(() => {
      if (
        availableQuarters
          .value.length ===
        0
      ) {
        return -1;
      }

      const index =
        availableQuarters
          .value
          .indexOf(
            getCurrentQuarterKey()
          );

      return (
        index === -1
          ? 0
          : index
      );
    });

  const activeQuarterKey =
    computed(() => {
      if (
        availableQuarters
          .value.length ===
        0
      ) {
        return null;
      }

      const base =
        activeQuarterIndex.value;

      const shifted =
        base +
        options.quarterOffset.value;

      if (
        shifted < 0 ||
        shifted >=
          availableQuarters
            .value.length
      ) {
        return (
          availableQuarters
            .value[base]
        );
      }

      return (
        availableQuarters
          .value[shifted]
      );
    });

  const payDatesInActiveQuarter =
    computed(() => {
      if (
        !activeQuarterKey.value
      ) {
        return [];
      }

      return (
        payDatesByQuarter
          .value
          .get(
            activeQuarterKey.value
          ) ??
        []
      );
    });

  watch(
    activeQuarterKey,
    () => {
      selectDefaultPayDateForQuarter();
    }
  );

  function selectDefaultPayDateForQuarter() {
    const quarter =
      activeQuarterKey.value;

    if (!quarter) {
      return;
    }

    const dates =
      payDatesByQuarter
        .value
        .get(quarter) ??
      [];

    if (
      dates.length === 0
    ) {
      return;
    }

    /* Date déjà choisie dans ce trimestre (filtres retrouvés de la session) : gardée. */
    if (
      options.selectedDate.value !== null &&
      dates.includes(
        options.selectedDate.value
      )
    ) {
      return;
    }

    if (
      quarter ===
      getCurrentQuarterKey()
    ) {
      const ascending =
        [...dates].sort(
          (a, b) =>
            a.localeCompare(b)
        );

      const next =
        ascending.find(
          date =>
            date >= todayISO()
        );

      options.selectedDate.value =
        next ??
        ascending[
          ascending.length - 1
        ];

      return;
    }

    options.selectedDate.value =
      dates[0];
  }

  return {
    activeQuarterKey,
    payDatesInActiveQuarter,
    selectDefaultPayDateForQuarter,
  };
}
