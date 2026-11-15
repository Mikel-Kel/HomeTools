import {
  ref,
  watch,
} from "vue";

import { useStorageBackend } from "@/composables/useStorageBackend";

import { loadFileFromPath } from "@/services/driveAdapter";

/* =========================
   Photos des étiquettes de la cave

   Contrat : ../Backend/docs/wine-cellar-contract.md, § 5.
   photo d'un vin = clé de l'image dans le magasin data
   (wine/Etiquettes/w<WineID>.jpg) : /api/s3/read en Object
   Storage, fichier du même chemin en Local Drive
   (loadFileFromPath).

   Cache en mémoire pour la session, par backend et par clé :
   une photo ne change que si sa clé change. Une image
   absente est retenue comme telle ; une lecture en échec
   (réseau, proxy) est retentée à la demande suivante.
   Lectures limitées à MAX_PARALLEL à la fois (vignettes de
   la liste).
========================= */

const MAX_PARALLEL = 4;

/* URL d'objet de l'image, null si elle n'existe pas. */
const cache =
  new Map<string, Promise<string | null>>();

let running = 0;

const waiting: (() => void)[] = [];

async function withSlot<T>(
  task: () => Promise<T>
): Promise<T> {
  if (running >= MAX_PARALLEL) {
    await new Promise<void>(resolve => waiting.push(resolve));
  }

  running += 1;

  try {
    return await task();
  } finally {
    running -= 1;
    waiting.shift()?.();
  }
}

export function loadWinePhoto(
  key: string
): Promise<string | null> {
  const { backend } =
    useStorageBackend();

  const cacheKey =
    `${backend.value}:${key}`;

  const cached =
    cache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const loading =
    withSlot(() => loadFileFromPath(key))
      .then(blob => (blob ? URL.createObjectURL(blob) : null))
      .catch(err => {
        cache.delete(cacheKey);

        console.warn(
          "Unable to read the label photo",
          key,
          err
        );

        return null;
      });

  cache.set(cacheKey, loading);

  return loading;
}

/*
  Photo d'un vin pour un composant : url null tant qu'elle
  n'est pas chargée, ou sans photo. active false : pas de
  chargement (vignette hors de l'écran).
*/
export function useWinePhoto(
  key: () => string | null,
  active: () => boolean = () => true
) {
  const url =
    ref<string | null>(null);

  /* L'image ne s'affiche pas (fichier illisible) : pictogramme. */
  const failed =
    ref(false);

  watch(
    [key, active],

    async ([photoKey, isActive], _previous, onCleanup) => {
      let cancelled = false;

      onCleanup(() => {
        cancelled = true;
      });

      failed.value = false;

      if (!photoKey) {
        url.value = null;
        return;
      }

      if (!isActive) {
        return;
      }

      const loaded =
        await loadWinePhoto(photoKey);

      if (!cancelled) {
        url.value = loaded;
      }
    },

    {
      immediate: true,
    }
  );

  return {
    url,
    failed,
  };
}
