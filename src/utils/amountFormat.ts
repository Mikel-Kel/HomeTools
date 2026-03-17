/* =========================================
   Amount formatting utilities
========================================= */

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
    amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  )
}