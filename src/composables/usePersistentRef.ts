import {
  ref,
  watch,
  type Ref,
} from "vue";

import {
  getSessionItem,
  setSessionItem,
} from "@/services/environment/browserStorage";

/* =========================
   Filtres conservés pendant la session

   Remplace ref(défaut) pour un filtre de page : la valeur
   est retrouvée en revenant sur la page, rechargement
   compris, et oubliée à la fermeture de l'onglet ou de l'app
   (sessionStorage). Valeurs sérialisables en JSON uniquement.

   La page reste responsable de vérifier qu'une valeur
   retrouvée existe encore (catégorie, année…) et de revenir
   au défaut sinon.

   Clés préfixées par l'environnement (browserStorage.ts).
========================= */

const PREFIX = "filters.";

function readStored<T>(
  key: string
): { found: true; value: T } | { found: false } {
  try {
    const raw =
      getSessionItem(PREFIX + key);

    if (raw === null) {
      return { found: false };
    }

    return {
      found: true,
      value: JSON.parse(raw) as T,
    };

  } catch {
    return { found: false };
  }
}

export function usePersistentRef<T>(
  key: string,
  defaultValue: T
): Ref<T> {
  const stored =
    readStored<T>(key);

  const value =
    ref(
      stored.found ? stored.value : defaultValue
    ) as Ref<T>;

  watch(
    value,

    current => {
      /* Stockage indisponible (navigation privée) : valeur gardée pour la page seulement. */
      setSessionItem(
        PREFIX + key,
        JSON.stringify(current)
      );
    },

    {
      deep: true,
    }
  );

  return value;
}
