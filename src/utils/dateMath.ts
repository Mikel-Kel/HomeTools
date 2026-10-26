/* =========================
   Calculs de dates (ISO AAAA-MM-JJ)
========================= */

function pad(
  value: number
): string {
  return String(value).padStart(2, "0");
}

/*
  Date ISO décalée de n mois ; le jour est ramené au
  dernier jour du mois si besoin (31.01 + 1 mois = 28.02).
*/
export function addMonths(
  date: string,
  months: number
): string {
  const [year, month, day] =
    date.split("-").map(Number);

  const target =
    new Date(year, month - 1 + months, 1);

  const lastDay =
    new Date(
      target.getFullYear(),
      target.getMonth() + 1,
      0
    ).getDate();

  return (
    `${target.getFullYear()}-` +
    `${pad(target.getMonth() + 1)}-` +
    `${pad(Math.min(day, lastDay))}`
  );
}
