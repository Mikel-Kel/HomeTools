import {
  asArray,
  asNumber,
  asObject,
  asString,
  ContractError,
  type JsonObject,
} from "@/contracts/read";

/* =========================
   Saisies de l'iPhone publiées par le Mac

   Contrat : ../Backend/docs/mobile-expense-contract.md, § 5
   et § 7 (capacité mobileExpense).

   mobile/mobile.json (mobile_export.py), seuls les champs
   lus par HomeTools :
     { "version": 1, "generatedAt": "…",
       "paymentMeans": [ { "cardId": 9, "label": "Card EUR" } ],
       "entries": [ { "id": "3f2b8c1e-0000-4000-8000-000000000001",
                      "paidAt": "2026-12-01T12:41:55",
                      "cardId": 9, "owner": "alex",
                      "amount": 23.40, "currency": "CHF" } ] }

   entries : saisies des 60 derniers jours et toutes les
   saisies ouvertes ; une saisie plus ancienne en est absente.
   paidAt : heure locale du paiement, sans fuseau.

   Liaison fausse : PWA-MEX_<AAAAMMJJHHMMSS>_<id>_UNL.json,
   MOBILE_EXPENSE_UNLINKED, payload { id, source } ; la saisie
   redevient ouverte et ce mouvement ne lui est plus proposé.
========================= */

export const MOBILE_FOLDER = "mobile";

export const MOBILE_FILE = "mobile.json";

export interface MobileExpenseEntry {
  id: string;
  paidAt: string;
  owner: string | null;
  amount: number;
  currency: string;

  /* Libellé de la carte sur l'iPhone ; null si elle n'y est plus proposée. */
  cardLabel: string | null;
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

/* Saisies par identifiant. */
export function readMobileEntries(
  raw: unknown
): Map<string, MobileExpenseEntry> {
  const file =
    asObject(raw);

  if (
    !file ||
    asNumber(file.version) !== 1 ||
    !Array.isArray(file.entries)
  ) {
    throw new ContractError(
      MOBILE_FILE,
      "invalid format"
    );
  }

  const cardLabels =
    new Map(
      objects(file.paymentMeans)
        .map(mean => [asNumber(mean.cardId), asString(mean.label).trim()])
    );

  return new Map(
    objects(file.entries)
      .map(entry => ({
        id: asString(entry.id).trim(),
        paidAt: asString(entry.paidAt),
        owner: asString(entry.owner).trim() || null,
        amount: asNumber(entry.amount),
        currency: asString(entry.currency),
        cardLabel: cardLabels.get(asNumber(entry.cardId)) || null,
      }))
      .filter(entry => entry.id)
      .map(entry => [entry.id, entry])
  );
}

export function unlinkEventSuffix(
  id: string
): string {
  return `${id}_UNL`;
}
