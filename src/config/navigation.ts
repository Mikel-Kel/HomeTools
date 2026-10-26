/* =========================
   Pages de l'application

   Liste unique, partagée par le menu de l'accueil et la
   barre de navigation des autres pages : une nouvelle page
   s'ajoute ici.
========================= */

export interface NavigationItem {
  path: string;
  label: string;
  icon: string;

  /* Affiche la pastille d'état du housekeeping. */
  health?: boolean;

  /* Pages détail rattachées à cette entrée. */
  related?: string[];
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
  { path: "/follow-up", label: "Follow-up", icon: "followup" },
  { path: "/budget", label: "Budget", icon: "budget" },
  { path: "/indicators", label: "Indicators", icon: "indicators" },
  { path: "/documentsArchive", label: "Archives", icon: "bookshelf" },
  { path: "/housekeeping", label: "Housekeeping", icon: "pages_warning", health: true },
];
