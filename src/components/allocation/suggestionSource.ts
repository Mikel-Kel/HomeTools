import type { AllocationSuggestion } from "@/contracts/spending";

/* =========================
   Source d'une suggestion d'allocation

   Libellé court (pastille), explication (info-bulle) et
   texte affiché sous le commentaire pour la suggestion
   appliquée.
========================= */

export function sourceLabel(
  suggestion: AllocationSuggestion
): string {
  switch (suggestion.source) {
    case "rule":
      return "Rule";

    case "learn-party":
    case "learn-text":
      return suggestion.recent === null
        ? "Learned"
        : `Learned ${suggestion.recent}/10`;

    case "party":
      return "Party";

    case "bank":
      return "Bank";

    case "mobile":
      return "iPhone";
  }
}

export function sourceTitle(
  suggestion: AllocationSuggestion
): string {
  switch (suggestion.source) {
    case "rule":
      return suggestion.ruleId === null
        ? "Allocation rule"
        : `Allocation rule ${suggestion.ruleId}`;

    case "learn-party":
      return "Learned from the past allocations of this party";

    case "learn-text":
      return "Learned from the past allocations of similar bank texts";

    case "party":
      return "Party of the movement, no rule nor history";

    case "bank":
      return "Party of the bank, no rule nor history";

    case "mobile":
      return "Entered on the iPhone";
  }
}

/* Source sous le commentaire : « Learned 3/10 · for <partie> ». */
export function sourceText(
  suggestion: AllocationSuggestion
): string {
  return [
    suggestion.contradicted
      ? `${sourceLabel(suggestion)}, contradicted by history`
      : sourceLabel(suggestion),
    suggestion.allocPartyName
      ? `for ${suggestion.allocPartyName}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
