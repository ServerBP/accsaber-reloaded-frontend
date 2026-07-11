import { ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

export function useOwnedItemIds(
  userId: MaybeRefOrGetter<string | null | undefined>,
  enabled: MaybeRefOrGetter<boolean>,
) {
  const ownedIds = ref<Set<string>>(new Set())
  let requestId = 0
  let fetchedUserId: string | null = null

  watch(
    () => ({ id: toValue(userId), on: toValue(enabled) }),
    async ({ id, on }) => {
      if (fetchedUserId !== id) {
        ownedIds.value = new Set()
        fetchedUserId = null
      }
      if (!id || !on || fetchedUserId === id) return
      const token = ++requestId
      try {
        const { getUserItems } = await import('@/api/items')
        const items = await getUserItems(id)
        if (token === requestId) {
          ownedIds.value = new Set(items.map((u) => u.item.id))
          fetchedUserId = id
        }
      } catch {
        if (token === requestId) ownedIds.value = new Set()
      }
    },
    { immediate: true },
  )

  return { ownedIds }
}
