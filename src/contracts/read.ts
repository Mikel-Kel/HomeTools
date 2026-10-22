/* =========================
   Lecture défensive des JSON publiés
========================= */

/*
  Les fichiers publiés par le Mac sont lus comme `unknown`
  puis convertis par les fonctions de lecture de chaque
  contrat (src/contracts/*.ts). Ces helpers retournent une
  valeur sûre ; une donnée manquante prend la valeur par
  défaut fournie.
*/

export type JsonObject = Record<string, unknown>;

export function asObject(
  value: unknown
): JsonObject | null {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  )
    ? value as JsonObject
    : null;
}

export function asArray(
  value: unknown
): unknown[] {
  return Array.isArray(value)
    ? value
    : [];
}

export function asString(
  value: unknown,
  fallback = ""
): string {
  return typeof value === "string"
    ? value
    : fallback;
}

export function asNumber(
  value: unknown,
  fallback = 0
): number {
  const number =
    typeof value === "number"
      ? value
      : Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

export function asBoolean(
  value: unknown
): boolean {
  return value === true;
}

/*
  Erreur levée quand un fichier n’a pas la forme attendue :
  son message nomme le fichier, pour l’afficher tel quel.
*/
export class ContractError extends Error {
  constructor(
    fileName: string,
    detail: string
  ) {
    super(`${fileName}: ${detail}`);
    this.name = "ContractError";
  }
}
