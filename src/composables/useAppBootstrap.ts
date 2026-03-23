import { useAppParameters } from "@/composables/useAppParameters"
import { useAllocationTags } from "@/composables/allocations/useAllocationTags"
import { useBanks } from "@/composables/useBanks"
import { useCategories } from "@/composables/useCategories"
import { useDocumentTags } from "@/composables/useDocumentTags"
/*import { useFXRates } from "@/composables/useFXRates"*/
import { useParties } from "@/composables/useParties"

let loaded = false

export function useAppBootstrap() {

  const { load: loadAppParameters } = useAppParameters()

  const allocationTagsStore = useAllocationTags()
  const banksStore = useBanks()
  const categoriesStore = useCategories()
  const documentTagsStore = useDocumentTags()
/*  const fxRatesStore = useFXRates()*/
  const partiesStore = useParties()

  async function loadSettings() {
    if (loaded) {
      return
    }
    console.log("🚀 GLOBAL SETTINGS LOAD START")
    try {
      // 🔴 1. AppParameters FIRST (critical)
      await loadAppParameters()
      // 🟢 2. All dependent settings in parallel
      await Promise.all([
        allocationTagsStore.load(),
        banksStore.load(),
        categoriesStore.load(),
        documentTagsStore.load(),
/*        fxRatesStore.load(),*/
        partiesStore.load()
      ])
      loaded = true
      console.log("✅ GLOBAL SETTINGS LOADED")
    } catch (e) {
      console.error("❌ GLOBAL SETTINGS FAILED", e)
      throw e
    }
  }

  return {
    loadSettings
  }
}