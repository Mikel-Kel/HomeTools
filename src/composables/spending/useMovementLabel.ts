import { isVisibleParty } from "@/contracts/parties";

import { useParties } from "@/composables/useParties";
import { useTransferTypes } from "@/composables/useTransferTypes";

import type { SpendingRecord } from "@/composables/spending/useSpending";

/* =========================
   Libellé affiché d'un mouvement

   Règle : ../Backend/docs/spending-contract.md, § 3.
   - Contrepartie identifiée (movementPartyID) et non
     générique : nom de la partie, inséré à la place de « * »
     dans le descriptionPattern du type d'opération s'il y en
     a un, suivi de « - <détail> » quand le texte de la banque
     contient « | » (texte après le séparateur).
   - Sinon : le texte de la banque.

   La contrepartie identifiée n'est jamais confondue avec la
   partie d'allocation (partyID).
========================= */

const SEPARATOR = " | ";

export function useMovementLabel() {

  const { getParty } = useParties();

  const {
    getTransferType,
    load: loadTransferTypes,
  } = useTransferTypes();

  /*
    Types d'opération, chargés à la demande : sans eux, le
    nom de la partie est affiché sans motif.
  */
  async function load(): Promise<void> {
    try {
      await loadTransferTypes();
    } catch {
      /* transferTypes.json indisponible : libellés sans motif */
    }
  }

  /* Texte de la banque, tel que reçu (partyName s'il est vide). */
  function bankText(
    record: SpendingRecord
  ): string {
    return record.bankDescription || record.party;
  }

  function label(
    record: SpendingRecord
  ): string {
    const bank =
      bankText(record);

    const party =
      record.movementPartyID === null
        ? undefined
        : getParty(record.movementPartyID);

    if (
      !party ||
      party.generic ||
      !isVisibleParty(party)
    ) {
      return bank;
    }

    const pattern =
      record.transferTypeID === null
        ? null
        : getTransferType(record.transferTypeID)?.descriptionPattern ?? null;

    const name =
      pattern?.includes("*")
        ? pattern.replace("*", party.label)
        : party.label;

    const separator =
      bank.indexOf(SEPARATOR);

    const detail =
      separator >= 0
        ? bank.slice(separator + SEPARATOR.length).trim()
        : "";

    return detail
      ? `${name} - ${detail}`
      : name;
  }

  /* Seconde ligne : texte de la banque, s'il diffère du libellé. */
  function secondLine(
    record: SpendingRecord
  ): string | null {
    const bank =
      bankText(record);

    return bank === label(record)
      ? null
      : bank;
  }

  return {
    load,
    label,
    secondLine,
  };

}
