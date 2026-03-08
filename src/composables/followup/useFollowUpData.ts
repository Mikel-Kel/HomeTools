import { ref, watch } from "vue"
import { useDrive } from "@/composables/useDrive"
import { useDriveWatcher } from "@/composables/useDriveWatcher"
import { loadJSONFromFolder } from "@/services/google/driveRepository"

export function useFollowUpData() {

  const { folders } = useDrive()

  const followUpRaw = ref<any | null>(null)
  const budgetRaw = ref<any | null>(null)

  const followUpLastModified = ref<string | null>(null)

  async function loadFollowUp() {

    const data =
      await loadJSONFromFolder(
        folders.value.allocations.budget,
        "FollowUp.json"
      )

    if (!data)
      throw new Error("FollowUp.json not found")

    followUpRaw.value = data
  }

  async function loadBudget() {

    const data =
      await loadJSONFromFolder(
        folders.value.allocations.budget,
        "budget.json"
      )

    if (!data)
      throw new Error("budget.json not found")

    budgetRaw.value = data
  }

  useDriveWatcher({
    folderId: folders.value.allocations.budget,
    fileName: "FollowUp.json",
    lastKnownModified: followUpLastModified,
    onChanged: loadFollowUp
  })

  return {

    followUpRaw,
    budgetRaw,

    loadFollowUp,
    loadBudget
  }
}