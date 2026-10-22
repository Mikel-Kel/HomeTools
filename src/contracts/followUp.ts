import {
  asArray,
  asBoolean,
  asNumber,
  asObject,
  asString,
  type JsonObject,
} from "@/contracts/read";

/* =========================
   Fichiers

   Exportés dans allocations/budget/ par
   exportFollowUpAggregates, exportBudget et
   exportFollowUpDetails_core.
========================= */

export const FOLLOW_UP_FOLDER = "allocations/budget";
export const FOLLOW_UP_FILE = "FollowUp.json";
export const BUDGET_FILE = "budget.json";

export function followUpDetailsFile(
  year: number
): string {
  return `FollowUpDetails-${year}.json`;
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

function asNullableNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number =
    asNumber(value, Number.NaN);

  return Number.isNaN(number)
    ? null
    : number;
}

/* =========================
   FollowUp.json — agrégats par sous-catégorie

     { "updatedAt": "…",
       "categories": [
         { "categoryId": 1,
           "years": [
             { "year": 2026,
               "items": [ { "subCategoryId": 6, "amount": 0,
                            "monthToDate": 0,
                            "amountOffBudget": 0,
                            "monthToDateOffBudget": 0 } ] } ] } ] }
========================= */

export interface FollowUpYearItem {
  subCategoryId: number;
  amount: number;
  monthToDate: number;
  amountOffBudget: number;
  monthToDateOffBudget: number;
}

export interface FollowUpYear {
  year: number;
  items: FollowUpYearItem[];
}

export interface FollowUpCategory {
  categoryId: number;
  years: FollowUpYear[];
}

export interface FollowUpFile {
  updatedAt: string | null;
  categories: FollowUpCategory[];
}

export function readFollowUp(
  raw: unknown
): FollowUpFile {
  const file =
    asObject(raw);

  return {
    updatedAt:
      asString(file?.updatedAt) || null,

    categories:
      objects(file?.categories).map(
        category => ({
          categoryId:
            asNumber(category.categoryId),

          years:
            objects(category.years).map(
              year => ({
                year:
                  asNumber(year.year),

                items:
                  objects(year.items).map(
                    item => ({
                      subCategoryId:
                        asNumber(item.subCategoryId),

                      amount:
                        asNumber(item.amount),

                      monthToDate:
                        asNumber(item.monthToDate),

                      amountOffBudget:
                        asNumber(item.amountOffBudget),

                      monthToDateOffBudget:
                        asNumber(item.monthToDateOffBudget),
                    })
                  ),
              })
            ),
        })
      ),
  };
}

/* =========================
   budget.json — budget mensuel par sous-catégorie

     { "budgets": [
         { "year": 2026, "month": 1,
           "items": [ { "categoryId": 1, "subCategoryId": 6,
                        "amount": 0 } ] } ] }
========================= */

export interface BudgetItem {
  categoryId: number;
  subCategoryId: number;
  amount: number;
}

export interface BudgetMonth {
  year: number;
  month: number;
  items: BudgetItem[];
}

export interface BudgetFile {
  updatedAt: string | null;
  budgets: BudgetMonth[];
}

export function readBudget(
  raw: unknown
): BudgetFile {
  const file =
    asObject(raw);

  return {
    updatedAt:
      asString(file?.updatedAt) || null,

    budgets:
      objects(file?.budgets).map(
        month => ({
          year:
            asNumber(month.year),

          month:
            asNumber(month.month),

          items:
            objects(month.items).map(
              item => ({
                categoryId:
                  asNumber(item.categoryId),

                subCategoryId:
                  asNumber(item.subCategoryId),

                amount:
                  asNumber(item.amount),
              })
            ),
        })
      ),
  };
}

/* =========================
   FollowUpDetails-<année>.json — allocations de l’année

     { "year": 2026,
       "items": [
         { "categoryId": 1, "subCategoryId": 1,
           "allocationId": "<FITID>", "allocationNb": 0,
           "partyId": 835, "allocationDate": "2026-01-15",
           "amount": 200, "amountCcy": 0,
           "description": "…", "bankDescription": "…",
           "currency": "", "tagId": null,
           "pending": false } ] }

   pending : mouvement renvoyé en ré-allocation, qui garde
   ses allocations jusqu’à la release qui les remplace.
========================= */

export interface FollowUpDetailItem {
  allocationId: string;
  categoryId: number;
  subCategoryId: number;
  allocationDate: string;
  amount: number;
  amountCcy: number;
  currency: string;
  description: string;
  bankDescription: string;
  partyId: number | null;
  tagId: number | null;
  pending: boolean;
}

export interface FollowUpDetailsFile {
  year: number;
  items: FollowUpDetailItem[];
}

export function readFollowUpDetails(
  raw: unknown
): FollowUpDetailsFile {
  const file =
    asObject(raw);

  return {
    year:
      asNumber(file?.year),

    items:
      objects(file?.items)
        .filter(
          item =>
            asString(item.allocationId) !== "" &&
            asString(item.allocationDate) !== ""
        )
        .map(
          item => ({
            allocationId:
              asString(item.allocationId),

            categoryId:
              asNumber(item.categoryId),

            subCategoryId:
              asNumber(item.subCategoryId),

            allocationDate:
              asString(item.allocationDate),

            amount:
              asNumber(item.amount),

            amountCcy:
              asNumber(item.amountCcy),

            currency:
              asString(item.currency),

            description:
              asString(item.description),

            bankDescription:
              asString(item.bankDescription),

            partyId:
              asNullableNumber(item.partyId),

            tagId:
              asNullableNumber(item.tagId),

            pending:
              asBoolean(item.pending),
          })
        ),
  };
}
