import { ref } from "vue";
import { loadJSONFromFolder } from "@/services/google/driveRepository";
import { useDrive } from "@/composables/useDrive";

/* =========================
   Types
========================= */

export interface FXRate {
  currency: string;
  rate: number;
}

interface FXRatesFile {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

/* =========================
   State
========================= */

const baseCurrency = ref<string>("CHF");
const ratesDate = ref<string | null>(null);
const rates = ref<FXRate[]>([]);
const loaded = ref(false);

/* =========================
   Composable
========================= */

export function useFXRates() {

  const { folders } = useDrive();

  async function load(): Promise<void> {

    if (loaded.value) return;

    const raw = await loadJSONFromFolder<FXRatesFile>(
      folders.value.settings,
      "exchangeRates.json"
    );

    if (
      !raw ||
      !raw.base ||
      !raw.date ||
      typeof raw.rates !== "object"
    ) {
      throw new Error("Invalid exchangeRates.json format");
    }

    baseCurrency.value = raw.base;
    ratesDate.value = raw.date;

    rates.value = Object.entries(raw.rates).map(
      ([currency, rate]) => ({
        currency,
        rate
      })
    );

    loaded.value = true;
  }

  function getRate(currency: string): number | undefined {
    return rates.value.find(r => r.currency === currency)?.rate;
  }

  function getAmountCcy(amount: number, currency: string): number {
    if (currency === baseCurrency.value) return amount;
    const rate = getRate(currency);
    if (!rate) return amount;
    return amount / rate;
  }

  return {
    baseCurrency,
    ratesDate,
    rates,
    load,
    getRate,
    getAmountCcy,
  };

}