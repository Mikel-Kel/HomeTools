/* =========================================
   Amount formatting utilities
========================================= */

/*
  Format unique des nombres dans toute l'application,
  indépendant de la langue du navigateur :
  apostrophe pour les milliers, point décimal.
*/
const NUMBER_LOCALE = "de-CH"

export type AmountFormatOptions = {
  showPlus?: boolean
}

export function formatAmount(
  amount: number | null | undefined,
  options: AmountFormatOptions = {}
): string {

  if (amount == null) return ""

  const { showPlus = false } = options

  const sign =
    showPlus && amount > 0 ? "+" : ""

  return (
    sign +
    amount.toLocaleString(NUMBER_LOCALE, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  )
}

export function formatInteger(
  value: number | null | undefined
): string {

  if (value == null) return ""

  return Math
    .round(value)
    .toLocaleString(NUMBER_LOCALE)
}

/*
  Valeur mesurée (compteur, température…) : entière si
  elle l'est, sinon jusqu'à deux décimales.
*/
export function formatMeasure(
  value: number | null | undefined
): string {

  if (value == null) return ""

  return value.toLocaleString(NUMBER_LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
}
