import type { CrateContentResponse, ItemResponse } from '@/types/api/items'
import { ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

export function useCrateContents(item: MaybeRefOrGetter<ItemResponse | null | undefined>) {
  const contents = ref<CrateContentResponse[]>([])
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
        contents.value = []
        loading.value = false
        return
      }
      loading.value = true
      try {
        const { getCrateContents } = await import('@/api/crates')
        const result = await getCrateContents(crateId)
        if (token === requestId) contents.value = result
      } catch {
        if (token === requestId) contents.value = []
      } finally {
        if (token === requestId) loading.value = false
      }
    },
    { immediate: true },
  )

  return { contents, loading }
}
