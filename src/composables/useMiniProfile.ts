import { getUserEquippedItems } from '@/api/items'
import { getUserLevel, getUserOverallStatistics } from '@/api/users'
import type { EquippedItemsResponse } from '@/types/api/items'
import type { LevelResponse, UserCategoryStatisticsResponse } from '@/types/api/users'
import { ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

export interface MiniProfile {
  stats: UserCategoryStatisticsResponse | null
  level: LevelResponse | null
  equipped: EquippedItemsResponse
}

const CACHE_LIMIT = 50
const cache = new Map<string, MiniProfile>()
const inflight = new Map<string, Promise<MiniProfile>>()

function emptyProfile(): MiniProfile {
  return { stats: null, level: null, equipped: {} }
}

function remember(userId: string, profile: MiniProfile) {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(userId, profile)
}

async function load(userId: string): Promise<MiniProfile> {
  const [stats, level, equipped] = await Promise.all([
    getUserOverallStatistics(userId).catch(() => null),
    getUserLevel(userId).catch(() => null),
    getUserEquippedItems(userId).catch(() => ({}) as EquippedItemsResponse),
  ])
  return { stats, level, equipped: equipped ?? {} }
}

function fetchMiniProfile(userId: string): Promise<MiniProfile> {
  const cached = cache.get(userId)
  if (cached) return Promise.resolve(cached)

  const pending = inflight.get(userId)
  if (pending) return pending

  const request = load(userId)
    .then((profile) => {
      remember(userId, profile)
      return profile
    })
    .catch(() => emptyProfile())
    .finally(() => inflight.delete(userId))

  inflight.set(userId, request)
  return request
}

export function useMiniProfile(userId: MaybeRefOrGetter<string>) {
  const profile = ref<MiniProfile | null>(null)
  const loading = ref(false)

  watch(
    () => toValue(userId),
    (id) => {
      if (!id) {
        profile.value = null
        loading.value = false
        return
      }

      const cached = cache.get(id)
      if (cached) {
        profile.value = cached
        loading.value = false
        return
      }

      profile.value = null
      loading.value = true
      fetchMiniProfile(id).then((result) => {
        if (toValue(userId) !== id) return
        profile.value = result
        loading.value = false
      })
    },
    { immediate: true },
  )

  return { profile, loading }
}
