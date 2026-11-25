import {
  asArray,
  asBoolean,
  asNumber,
  asObject,
  asString,
  ContractError,
  type JsonObject,
} from "@/contracts/read";

/* =========================
   Catégories et sous-catégories

   Contrat complet : ../Backend/docs/categories-contract.md.

   settings/categories.json (exportCategories) :
     { "version": 1, "updatedAt": "…",
       "categories": [ { "id": 5, "label": "Assurances",
                         "nature": "E", "displayScope": "P",
                         "seq": 600,
                         "subcategories": [ { "id": 15,
                                              "label": "Maladie",
                                              "seq": 910,
                                              "status": "A",
                                              "mobileEntry": false } ] } ] }

   Toutes les catégories (même sans sous-catégorie) et toutes
   les sous-catégories (même clôturées). mobileEntry : la
   sous-catégorie est proposée sur l'iPhone si elle est
   active (../Backend/docs/mobile-expense-contract.md, § 3.3) ;
   absent = false.
========================= */

export const CATEGORIES_FOLDER = "settings";

export const CATEGORIES_FILE = "categories.json";

export type CategoryNature = "-" | "I" | "E";

/*
  P : catégorie affichée ; X : catégorie technique, masquée
  dans le suivi (To allocate, Off B/S…).
*/
export type CategoryDisplayScope = "P" | "X";

/*
  A : sous-catégorie active ; C : clôturée, conservée dans
  l'historique mais plus proposée à l'allocation.
*/
export type SubCategoryStatus = "A" | "C";

export interface SubCategory {
  id: number;
  seq: number;
  label: string;
  status: SubCategoryStatus;
  mobileEntry: boolean;
}

export interface Category {
  id: number;
  seq: number;
  label: string;
  nature: CategoryNature;
  displayScope: CategoryDisplayScope;
  subcategories: SubCategory[];
}

function objects(
  value: unknown
): JsonObject[] {
  return asArray(value)
    .map(asObject)
    .filter(
      (item): item is JsonObject =>
        item !== null
    );
}

function bySeq(
  a: { seq: number; id: number },
  b: { seq: number; id: number }
): number {
  return a.seq - b.seq || a.id - b.id;
}

function readNature(
  value: unknown
): CategoryNature {
  return value === "I" || value === "E"
    ? value
    : "-";
}

/*
  Catégories et sous-catégories triées par seq puis id.
*/
export function readCategories(
  raw: unknown
): Category[] {
  const file =
    asObject(raw);

  if (
    !file ||
    asNumber(file.version) !== 1 ||
    !Array.isArray(file.categories)
  ) {
    throw new ContractError(
      CATEGORIES_FILE,
      "invalid format"
    );
  }

  return objects(file.categories)
    .map(
      category => ({
        id: asNumber(category.id),
        seq: asNumber(category.seq),
        label: asString(category.label),
        nature: readNature(category.nature),
        displayScope:
          (category.displayScope === "X" ? "X" : "P") as CategoryDisplayScope,

        subcategories: objects(category.subcategories)
          .map(
            sub => ({
              id: asNumber(sub.id),
              seq: asNumber(sub.seq),
              label: asString(sub.label),
              status:
                (sub.status === "C" ? "C" : "A") as SubCategoryStatus,
              mobileEntry: asBoolean(sub.mobileEntry),
            })
          )
          .sort(bySeq),
      })
    )
    .sort(bySeq);
}
