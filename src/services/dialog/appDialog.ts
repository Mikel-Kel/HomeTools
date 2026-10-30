import {
  shallowRef,
} from "vue";

/* =========================
   Dialogues de l'application

   Remplacent alert() et confirm() du navigateur. L'appel
   rend une promesse ; le dialogue est affiché par
   AppDialog.vue, monté une fois dans App.vue. Les demandes
   faites avant son montage (garde du routeur) ou pendant
   qu'un dialogue est ouvert attendent leur tour.
========================= */

export type ConfirmOptions = {
  title: string;
  message?: string;

  /* Libellé de l'action, par défaut « OK ». */
  confirmLabel?: string;

  /* Suppression ou action irréversible : bouton rouge, focus sur Cancel. */
  destructive?: boolean;
};

export type AlertOptions = {
  title: string;
  message?: string;
};

export type DialogRequest = {
  kind: "confirm" | "alert";
  title: string;
  message: string;
  confirmLabel: string;
  destructive: boolean;
  resolve: (confirmed: boolean) => void;
};

const queue: DialogRequest[] = [];

/* Dialogue affiché, lu par AppDialog.vue. */
export const currentDialog =
  shallowRef<DialogRequest | null>(null);

function open(
  request: Omit<DialogRequest, "resolve">
): Promise<boolean> {
  return new Promise(resolve => {
    queue.push({
      ...request,
      resolve,
    });

    if (!currentDialog.value) {
      currentDialog.value =
        queue.shift() ?? null;
    }
  });
}

/* Réponse de l'utilisateur, appelée par AppDialog.vue. */
export function answerDialog(
  confirmed: boolean
) {
  const request =
    currentDialog.value;

  if (!request) {
    return;
  }

  currentDialog.value =
    queue.shift() ?? null;

  request.resolve(confirmed);
}

export function confirmDialog(
  options: ConfirmOptions
): Promise<boolean> {
  return open({
    kind: "confirm",
    title: options.title,
    message: options.message ?? "",
    confirmLabel: options.confirmLabel ?? "OK",
    destructive: options.destructive ?? false,
  });
}

export async function alertDialog(
  options: AlertOptions
): Promise<void> {
  await open({
    kind: "alert",
    title: options.title,
    message: options.message ?? "",
    confirmLabel: "OK",
    destructive: false,
  });
}
