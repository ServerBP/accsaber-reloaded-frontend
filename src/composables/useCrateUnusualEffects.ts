import type { UnusualEffectResponse } from '@/types/api/items'
import { ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

export function useCrateUnusualEffects(crateId: MaybeRefOrGetter<string | null | undefined>) {
  const effects = ref<UnusualEffectResponse[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  let requestId = 0

  watch(
    () => toValue(crateId),
    () => {
      effects.value = []
      loaded.value = false
      loading.value = false
      requestId++
    },
  )

  async function load(): Promise<void> {
    if (loaded.value || loading.value) return
    const id = toValue(crateId)
    if (!id) return
    const token = ++requestId
    loading.value = true
    try {
      const { getCrateUnusualEffects } = await import('@/api/crates')
      const result = await getCrateUnusualEffects(id)
      if (token === requestId) effects.value = result
    } catch {
      if (token === requestId) effects.value = []
    } finally {
      if (token === requestId) {
        loading.value = false
        loaded.value = true
      }
    }
  }

  return { effects, loading, loaded, load }
}
