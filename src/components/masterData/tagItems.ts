import {
  ACC_TAG_TYPE,
  isTagUsed,
  type AllocationTag,
} from "@/contracts/allocationTags";

import {
  DOC_TAG_TYPE,
  type DocumentTag,
} from "@/contracts/documentTags";

import { formatInteger } from "@/utils/amountFormat";

/* =========================
   Tags de la page Master data

   Forme commune des tags des mouvements (Acc) et des
   documents (Doc), pour la liste et la fiche.
========================= */

export type TagType =
  | typeof ACC_TAG_TYPE
  | typeof DOC_TAG_TYPE;

export interface TagItem {
  id: number;
  label: string;
  seq: number;
  reserved: boolean;

  /* #rrggbb, tags Doc uniquement. */
  color: string | null;

  /* Nombre affiché dans la liste, et son libellé. */
  count: number | null;
  countLabel: string;

  /* Détail de l'usage, sous-titre de la fiche. */
  usage: string;

  /* null : usage inconnu (suppression impossible). */
  used: boolean | null;
}

export function fromAllocationTag(
  tag: AllocationTag
): TagItem {
  return {
    id: tag.id,
    label: tag.tagName,
    seq: tag.seqNb,
    reserved: tag.reserved,
    color: null,
    count: tag.usage.allocations,
    countLabel: "Allocations",
    usage:
      `${formatInteger(tag.usage.allocations)} allocations · ` +
      `${formatInteger(tag.usage.rules)} rules`,
    used: isTagUsed(tag),
  };
}

export function fromDocumentTag(
  tag: DocumentTag
): TagItem {
  return {
    id: tag.id,
    label: tag.tagName,
    seq: tag.seqNb,
    reserved: tag.reserved,
    color: tag.color,
    count: tag.usage?.documents ?? null,
    countLabel: "Documents",
    usage:
      tag.usage
        ? `${formatInteger(tag.usage.documents)} documents`
        : "Usage unknown",
    used:
      tag.usage
        ? tag.usage.documents > 0
        : null,
  };
}
