import { ref, computed, watch } from "vue"

export type AnalysisScope = "FULL" | "MTD" | "YTD"
export type NatureFilter = "ALL" | "I" | "E"

export function useFollowUpFilters() {

  const year = ref<number>(2026)

  const selectedCategory = ref<string>("*")
  const selectedSubCategory = ref<string | null>(null)

  const filtersOpen = ref(true)

  const natureFilter = ref<NatureFilter>("E")
  const showSecondaryCategories = ref(false)

  const analysisScope = ref<AnalysisScope>("YTD")

  const currentYear = new Date().getFullYear()

  const isCurrentYear = computed(() =>
    year.value === currentYear
  )

  watch(year, () => {
    if (!isCurrentYear.value && analysisScope.value !== "FULL") {
      analysisScope.value = "FULL"
    }
  })

  watch(natureFilter, () => {
    selectedCategory.value = "*"
    selectedSubCategory.value = null
  })

  function selectAllCategories() {
    selectedCategory.value = "*"
    selectedSubCategory.value = null
  }

  function selectCategory(id: number) {
    selectedCategory.value = String(id)
    selectedSubCategory.value = null
  }

  function selectSubCategory(id: number) {
    selectedSubCategory.value = String(id)
  }

  return {

    year,
    analysisScope,

    selectedCategory,
    selectedSubCategory,

    natureFilter,
    showSecondaryCategories,

    filtersOpen,
    isCurrentYear,

    selectAllCategories,
    selectCategory,
    selectSubCategory
  }
}