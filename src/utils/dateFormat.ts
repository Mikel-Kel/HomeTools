/* =========================================
   Date formatting utilities
========================================= */

type DateFormat = "text" | "short" | "iso" | "compact"

const MONTHS_EN = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec"
]

function toDate(value: string | number | Date | null | undefined): Date | null {

  if (value == null || value === "") return null

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value
  }

  const d = new Date(value)
  if (isNaN(d.getTime())) return null

  return d
}

function pad(n: number): string {
  return String(n).padStart(2,"0")
}

export function formatDate(
  value: string | number | Date | null | undefined,
  format: DateFormat = "text"
): string {

  const d = toDate(value)
  if (!d) return ""

  const day = pad(d.getDate())
  const month = pad(d.getMonth() + 1)
  const monthText = MONTHS_EN[d.getMonth()]
  const year = d.getFullYear()

  switch (format) {

    case "text":
      return `${day} ${monthText} ${year}`

    case "compact":
      return `${day} ${monthText}`

    case "short":
      return `${day}.${month}.${year}`

    case "iso":
      return `${year}-${month}-${day}`

    default:
      return `${year}-${month}-${day}`
  }
}