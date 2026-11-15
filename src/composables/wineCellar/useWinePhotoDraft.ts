import {
  onBeforeUnmount,
  ref,
  shallowRef,
} from "vue";

import {
  prepareWineImage,
  type PreparedWineImage,
} from "@/services/wineCellar/prepareWineImage";

/* =========================
   Photo choisie, pas encore envoyée

   Fichier choisi (sélecteur de fichiers sur Mac ; appareil
   photo, photothèque ou fichiers sur iPad) préparé par
   prepareWineImage : aperçu et image prête pour l'événement.
   Une seule photo à la fois ; l'aperçu est libéré quand elle
   est remplacée, effacée ou que le composant disparaît.
========================= */

export function useWinePhotoDraft() {
  const draft =
    shallowRef<PreparedWineImage | null>(null);

  const preparing =
    ref(false);

  /* Message lisible si la préparation échoue. */
  const error =
    ref("");

  /* Dernier choix : un choix plus ancien terminé après lui est ignoré. */
  let generation = 0;

  function release() {
    if (draft.value) {
      URL.revokeObjectURL(draft.value.previewUrl);
      draft.value = null;
    }
  }

  function clear() {
    generation += 1;
    release();
    preparing.value = false;
    error.value = "";
  }

  async function choose(
    file: File
  ): Promise<void> {
    clear();

    const current =
      generation;

    preparing.value = true;

    try {
      const prepared =
        await prepareWineImage(file);

      if (current !== generation) {
        URL.revokeObjectURL(prepared.previewUrl);
        return;
      }

      draft.value = prepared;
    } catch (err) {
      if (current === generation) {
        error.value =
          err instanceof Error
            ? err.message
            : "Unable to prepare the image.";
      }
    } finally {
      if (current === generation) {
        preparing.value = false;
      }
    }
  }

  /* Choix du champ fichier ; le champ est vidé pour pouvoir reprendre le même fichier. */
  function onFileInput(
    event: Event
  ): void {
    const input =
      event.target as HTMLInputElement;

    const file =
      input.files?.[0];

    input.value = "";

    if (file) {
      choose(file);
    }
  }

  onBeforeUnmount(clear);

  return {
    draft,
    preparing,
    error,
    clear,
    onFileInput,
  };
}
