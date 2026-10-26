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

/*
  Cours de marché : quatre décimales sous 10 (devises),
  deux au-delà (indices, fonds).
*/
export function formatQuote(
  value: number | null | undefined
): string {

  if (value == null) return ""

  const decimals = Math.abs(value) < 10 ? 4 : 2

  return value.toLocaleString(NUMBER_LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}

/*
  Variation en pour cent, toujours signée : +1.25 %.
*/
export function formatPercent(
  value: number | null | undefined
): string {

  if (value == null) return ""

  const sign = value > 0 ? "+" : ""

  return (
    sign +
    value.toLocaleString(NUMBER_LOCALE, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) +
    " %"
  )
}
