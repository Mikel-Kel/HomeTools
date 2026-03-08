import { computed } from "vue"
import { useCategories } from "@/composables/useCategories"

export function useFollowUpComputation(
  followUpRaw: any,
  budgetRaw: any,
  filters: any
) {

  const categoriesStore = useCategories()

  function getMonthIndex() {
    return new Date().getMonth() + 1
  }

  const items = computed(() => {

    if (!followUpRaw.value)
      return []

    const out:any[] = []

    if (filters.selectedCategory.value === "*") {

      for (const c of followUpRaw.value.categories) {

        const meta =
          categoriesStore.getCategory(c.categoryId)

        if (!meta) continue

        const yearData =
          c.years.find(
            (y:any) => y.year === filters.year.value
          )

        if (!yearData) continue

        const amount =
          yearData.items.reduce(
            (sum:number,i:any)=>
              sum +
              (
                filters.analysisScope.value === "MTD"
                  ? i.monthToDate
                  : i.amount
              ),
            0
          )

        out.push({
          id:String(c.categoryId),
          label:meta.label,
          amount
        })

      }

      return out
    }

    const catId =
      Number(filters.selectedCategory.value)

    const cat =
      followUpRaw.value.categories
        .find((c:any)=>c.categoryId===catId)

    const meta =
      categoriesStore.getCategory(catId)

    if (!cat || !meta)
      return []

    const yearData =
      cat.years.find(
        (y:any)=>y.year===filters.year.value
      )

    if (!yearData)
      return []

    const subTotals = new Map()

    for (const i of yearData.items) {

      const value =
        filters.analysisScope.value === "MTD"
          ? i.monthToDate
          : i.amount

      subTotals.set(
        i.subCategoryId,
        (subTotals.get(i.subCategoryId) ?? 0) + value
      )

    }

    for (const sub of meta.subcategories) {

      if (!subTotals.has(sub.id))
        continue

      if (
        filters.selectedSubCategory.value &&
        Number(filters.selectedSubCategory.value)
          !== sub.id
      )
        continue

      out.push({
        id:String(sub.id),
        label:sub.label,
        amount:subTotals.get(sub.id)
      })

    }

    return out

  })

  const totalItem = computed(()=>{

    if(!items.value.length)
      return null

    const amount =
      items.value.reduce(
        (s:any,i:any)=>s+i.amount,
        0
      )

    return {
      id:"total",
      label:"Total",
      amount
    }

  })

  return {
    items,
    totalItem
  }
}