/* =========================
   Suivi d'une catégorie ou d'une carte

   Choix segmenté Tracked / Untracked des fiches de Master
   data (tracked de categories.json, mobileTracked de
   bankingCards.json).
========================= */

export type Tracking =
  | "tracked"
  | "untracked";

export const TRACKING_OPTIONS: {
  value: Tracking;
  label: string;
}[] = [
  { value: "tracked", label: "Tracked" },
  { value: "untracked", label: "Untracked" },
];

export function toTracking(
  tracked: boolean
): Tracking {
  return tracked ? "tracked" : "untracked";
}
