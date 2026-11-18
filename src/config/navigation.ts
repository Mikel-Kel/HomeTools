/* =========================
   Pages de l'application

   Liste unique, partagée par le menu de l'accueil et la
   barre de navigation des autres pages : une nouvelle page
   s'ajoute ici. Une page liée à une capacité de
   l'environnement n'apparaît qu'avec elle (la route est
   aussi refusée sans elle : meta.capability).
========================= */

import type { Capabilities } from "@/contracts/environment";

import { hasCapability } from "@/services/environment/environmentState";

export interface NavigationItem {
  path: string;
  label: string;
  icon: string;

  /* Affiche la pastille d'état du housekeeping. */
  health?: boolean;

  /* Pages détail rattachées à cette entrée. */
  related?: string[];

  /* Début d'un groupe : écart supplémentaire avant l'entrée. */
  groupStart?: boolean;

  /* Capacité de l'environnement requise (§3.4). */
  capability?: keyof Capabilities;
}

export function isNavigationItemActive(
  item: NavigationItem,
  path: string
): boolean {
  return [item.path, ...(item.related ?? [])].some(
    prefix => path === prefix || path.startsWith(`${prefix}/`)
  );
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { path: "/spending", label: "Spending", icon: "spending", related: ["/allocation"] },
  { path: "/ledger", label: "Ledger", icon: "book" },
  { path: "/follow-up", label: "Follow-up", icon: "followup" },
  { path: "/documentsArchive", label: "Documents", icon: "bookshelf" },
  { path: "/budget", label: "Budget", icon: "budget" },
  { path: "/indicators", label: "Indicators", icon: "indicators" },
  { path: "/wine-cellar", label: "Wine cellar", icon: "wine", capability: "wineCellar" },
  { path: "/master-data", label: "Master data", icon: "process", groupStart: true },
  { path: "/housekeeping", label: "Housekeeping", icon: "pages_warning", health: true },
];

/* Pages de l'environnement courant (réactif : lit l'environnement). */
export function navigationItems(): NavigationItem[] {
  return NAVIGATION_ITEMS.filter(
    item => !item.capability || hasCapability(item.capability)
  );
}
