import type { VehicleService } from "@/contracts/indicators";

/* =========================
   Échéances d'entretien des véhicules

   À la date d'un relevé (fin de mois) :
   - kilométrage : « soon » quand il reste au plus 10 % de
     l'intervalle de service (1'000 km sans intervalle),
     « overdue » quand le prochain service est dépassé ;
   - service annuel : échéance un an après le dernier
     service ; « soon » d'un mois avant à un mois après,
     « overdue » au-delà ;
   - SAN (contrôle périodique) : échéance après le délai du
     véhicule (sanFrequencyYears, 2 ans par défaut) ;
     « soon » le mois qui précède, « overdue » dès qu'elle
     est dépassée.
========================= */

export type DueState =
  | "ok"
  | "soon"
  | "overdue";

export interface DateDue {
  state: DueState;
  due: string | null;
}

const KM_WARNING_RATIO = 0.1;
const KM_WARNING_DEFAULT = 1000;

const SERVICE_PERIOD_MONTHS = 12;
const SERVICE_MARGIN_MONTHS = 1;

const SAN_DEFAULT_YEARS = 2;
const SAN_WARNING_MONTHS = 1;

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

export function serviceKmState(
  remainingKm: number | null,
  service: VehicleService | null
): DueState {
  if (remainingKm === null) {
    return "ok";
  }

  if (remainingKm < 0) {
    return "overdue";
  }

  const threshold =
    service?.intervalKm
      ? service.intervalKm * KM_WARNING_RATIO
      : KM_WARNING_DEFAULT;

  return remainingKm <= threshold
    ? "soon"
    : "ok";
}

function dateDue(
  lastDate: string | null,
  asOf: string,
  periodMonths: number,
  warningMonths: number,
  graceMonths: number
): DateDue {
  if (!lastDate) {
    return { state: "ok", due: null };
  }

  const due =
    addMonths(lastDate, periodMonths);

  if (asOf > addMonths(due, graceMonths)) {
    return { state: "overdue", due };
  }

  if (asOf >= addMonths(due, -warningMonths)) {
    return { state: "soon", due };
  }

  return { state: "ok", due };
}

export function serviceDateDue(
  service: VehicleService | null,
  asOf: string
): DateDue {
  return dateDue(
    service?.lastServiceDate ?? null,
    asOf,
    SERVICE_PERIOD_MONTHS,
    SERVICE_MARGIN_MONTHS,
    SERVICE_MARGIN_MONTHS
  );
}

export function sanDue(
  service: VehicleService | null,
  asOf: string
): DateDue {
  return dateDue(
    service?.lastSanVisit ?? null,
    asOf,
    12 * (service?.sanFrequencyYears ?? SAN_DEFAULT_YEARS),
    SAN_WARNING_MONTHS,
    0
  );
}
