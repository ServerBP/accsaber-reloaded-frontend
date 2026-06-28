import { ref } from 'vue'
import type { ItemResponse } from '@/types/api/items'

let cache: Map<string, ItemResponse> | null = null
let inflight: Promise<Map<string, ItemResponse>> | null = null

export function useItemCatalog() {
  const itemsById = ref<Map<string, ItemResponse>>(cache ?? new Map<string, ItemResponse>())

  async function ensureLoaded(): Promise<void> {
    if (cache) {
      itemsById.value = cache
      return
    }
    if (!inflight) {
      inflight = import('@/api/items').then(({ getItems }) =>
        getItems().then((list) => {
          cache = new Map(list.map((item) => [item.id, item]))
          return cache
        }),
      )
    }
    try {
      itemsById.value = await inflight
    } catch {
      inflight = null
    }
  }

  return { itemsById, ensureLoaded }
}
