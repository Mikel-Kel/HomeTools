import { ref, watch, type Ref } from "vue"

export function useAmountInput(model: Ref<number | null | undefined>) {

  const input = ref("")
  const isEditing = ref(false)

  /* =========================
     Sync model → input
  ========================= */
  watch(
    model,
    (v) => {
      if (!isEditing.value) {
        input.value =
          v != null && !isNaN(v)
            ? Number(v).toFixed(2)
            : ""
      }
    },
    { immediate: true }
  )

  /* =========================
     Utils
  ========================= */

  function sanitize(raw: string): string {

    // autorisé : chiffres + . + ,
    let s = raw.replace(/[^\d.,]/g, "")

    // remplacer , par .
    s = s.replace(",", ".")

    // garder un seul point décimal
    const parts = s.split(".")
    if (parts.length > 2) {
      s = parts[0] + "." + parts.slice(1).join("")
    }

    return s
  }

  /* =========================
     Events
  ========================= */

  function onFocus(e?: Event) {
    isEditing.value = true

    input.value =
      model.value != null
        ? String(model.value)
        : ""

    // auto select tout
    setTimeout(() => {
      const el = e?.target as HTMLInputElement
      el?.select()
    }, 0)
  }

  function onInput(raw: string) {

    const clean = sanitize(raw)
    input.value = clean

    const n = Number(clean)

    if (Number.isFinite(n)) {
      model.value = n
    }
  }

  function onBlur() {
    isEditing.value = false

    input.value =
      model.value != null && !isNaN(model.value)
        ? Number(model.value).toFixed(2)
        : ""
  }

  return {
    input,
    onFocus,
    onInput,
    onBlur
  }
}