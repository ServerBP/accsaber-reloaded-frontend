import type { CrateModifierResponse, ItemResponse } from '@/types/api/items'
import { ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

export function useCrateModifiers(item: MaybeRefOrGetter<ItemResponse | null | undefined>) {
  const modifiers = ref<CrateModifierResponse[]>([])
  const loading = ref(false)
  let requestId = 0

  watch(
    () => {
      const it = toValue(item)
      return it && it.typeKey === 'crate' ? it.id : null
    },
    async (crateId) => {
      const token = ++requestId
      if (!crateId) {
        modifiers.value = []
        loading.value = false
        return
      }
      loading.value = true
      try {
        const { getCrateModifiers } = await import('@/api/crates')
        const result = await getCrateModifiers(crateId)
        if (token === requestId) modifiers.value = result
      } catch {
        if (token === requestId) modifiers.value = []
      } finally {
        if (token === requestId) loading.value = false
      }
    },
    { immediate: true },
  )

  return { modifiers, loading }
}
