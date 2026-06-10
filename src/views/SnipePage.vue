<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import PaginationControls from '@/components/common/PaginationControls.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import StatBlock from '@/components/common/StatBlock.vue'
import CountryFlag from '@/components/domain/CountryFlag.vue'
import LevelBadge from '@/components/domain/LevelBadge.vue'
import SnipeComparisonRow from '@/components/domain/SnipeComparisonRow.vue'
import SnipeTugOfWar from '@/components/domain/SnipeTugOfWar.vue'
import SupporterTierIcon from '@/components/domain/SupporterTierIcon.vue'
import { useColorExtract } from '@/composables/useColorExtract'
import { usePageMeta } from '@/composables/usePageMeta'
import ScoreDetailModal from '@/components/domain/ScoreDetailModal.vue'
import { buildSnipePlaylistUrl } from '@/api/snipe'
import { useAuthStore } from '@/stores/auth'
import { useCategoryStore } from '@/stores/categories'
import { useModifierStore } from '@/stores/modifiers'
import { useThemeStore } from '@/stores/theme'
import type { EquippedItemsResponse } from '@/types/api/items'
import type { SnipeComparisonResponse } from '@/types/api/snipe'
import type {
  LevelResponse,
  ScoreResponse,
  UserAllStatisticsResponse,
  UserResponse,
} from '@/types/api/users'
import type { ScoreDisplay } from '@/types/display'
import type { Page } from '@/types/pagination'
import { brightenRgb } from '@/utils/color'
import {
  readBorderColorValue,
  readBorderShapeValue,
  readTitleValue,
} from '@/utils/items'
import { toScoreDisplay } from '@/utils/mappers'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const categoryStore = useCategoryStore()
const modifierStore = useModifierStore()
const themeStore = useThemeStore()

const SIZE_VALUES = [10, 20, 50, 100] as const
const DEFAULT_SIZE = 20
const ALL_SIZE_FOR_LIST = 100
const SIZE_OPTIONS = [
  ...SIZE_VALUES.map((n) => ({ value: String(n), label: `${n} maps` })),
  { value: 'all', label: 'All snipes' },
]

const snipeCategoryCodes = computed(() =>
  categoryStore.categoryInfoList
    .filter((c) => c.code !== 'xp' && c.code !== 'overall')
    .map((c) => c.code),
)

const categoryOptions = computed(() => [
  { value: '', label: 'All categories' },
  ...snipeCategoryCodes.value.map((code) => ({
    value: code,
    label: categoryStore.getCategoryInfo(code)?.name ?? code,
  })),
])

const targetId = computed(() => route.params.userId as string)
const sniperId = computed(() => authStore.userId)

const currentPage = computed<number>(() => {
  const p = Number(route.query.page)
  return p > 0 ? p : 1
})

const currentSize = computed<number | 'all'>(() => {
  const raw = route.query.size
  if (raw === 'all') return 'all'
  const n = Number(raw)
  return (SIZE_VALUES as readonly number[]).includes(n) ? n : DEFAULT_SIZE
})

const listSize = computed(() =>
  currentSize.value === 'all' ? ALL_SIZE_FOR_LIST : currentSize.value,
)

const sizeSelectValue = computed(() =>
  currentSize.value === 'all' ? 'all' : String(currentSize.value),
)

const currentCategory = computed<string>(() => {
  const c = route.query.category
  if (typeof c !== 'string' || !c) return ''
  return snipeCategoryCodes.value.includes(c) ? c : ''
})

function setPage(page: number) {
  const query = { ...route.query }
  if (page <= 1) delete query.page
  else query.page = String(page)
  router.replace({ query })
}

function setSize(value: string) {
  const query = { ...route.query }
  delete query.page
  if (value === String(DEFAULT_SIZE)) delete query.size
  else query.size = value
  router.replace({ query })
}

function setCategory(value: string) {
  const query = { ...route.query }
  delete query.page
  if (!value) delete query.category
  else query.category = value
  router.replace({ query })
}

const target = ref<UserResponse | null>(null)
const sniper = ref<UserResponse | null>(null)
const targetLevel = ref<LevelResponse | null>(null)
const sniperLevel = ref<LevelResponse | null>(null)
const sniperEquipped = ref<EquippedItemsResponse>({})
const targetEquipped = ref<EquippedItemsResponse>({})

const sniperTitle = computed(() => readTitleValue(sniperEquipped.value.title?.item.value))
const sniperBorderShape = computed(() => readBorderShapeValue(sniperEquipped.value.profile_border_shape?.item.value))
const sniperBorderColor = computed(() => readBorderColorValue(sniperEquipped.value.profile_border_color?.item.value))
const targetTitle = computed(() => readTitleValue(targetEquipped.value.title?.item.value))
const targetBorderShape = computed(() => readBorderShapeValue(targetEquipped.value.profile_border_shape?.item.value))
const targetBorderColor = computed(() => readBorderColorValue(targetEquipped.value.profile_border_color?.item.value))
const data = ref<Page<SnipeComparisonResponse> | null>(null)
const loading = ref(false)

const sniperAllStats = ref<UserAllStatisticsResponse | null>(null)
const targetAllStats = ref<UserAllStatisticsResponse | null>(null)
const rankedTotals = ref<Map<string, number>>(new Map())
const reverseSnipeCount = ref<number | null>(null)
const tugLoading = ref(false)

const detailOpen = ref(false)
const detailScore = ref<ScoreDisplay | null>(null)
const detailUserId = ref<string>('')

const targetAvatar = computed(() => target.value?.cdnAvatarUrl ?? target.value?.avatarUrl ?? '')
const sniperAvatar = computed(() => sniper.value?.cdnAvatarUrl ?? sniper.value?.avatarUrl ?? '')
const { dominantColor } = useColorExtract(targetAvatar)

const heroAccent = computed(() => {
  const raw = dominantColor.value
  if (!raw) return 'var(--accent-overall)'
  return themeStore.theme === 'dark' ? brightenRgb(raw, 60) : raw
})

const rows = computed(() => data.value?.content ?? [])
const totalPages = computed(() => data.value?.totalPages ?? 0)
const totalElements = computed(() => data.value?.totalElements ?? 0)

const closestGapPct = computed(() => {
  if (rows.value.length === 0) return 0
  const r = rows.value[0]
  return (r.targetScore.accuracy - r.sniperScore.accuracy) * 100
})

const totalPointsToGain = computed(() =>
  rows.value.reduce((sum, r) => sum + r.scoreDelta, 0),
)

const totalApAtStake = computed(() =>
  rows.value.reduce((sum, r) => sum + (r.targetScore.ap - r.sniperScore.ap), 0),
)

const playlistUrl = computed(() =>
  sniperId.value
    ? buildSnipePlaylistUrl(sniperId.value, targetId.value, {
        size: currentSize.value === 'all' ? undefined : currentSize.value,
        category: currentCategory.value || undefined,
      })
    : '',
)

const downloadLabel = computed(() => {
  const categoryName = currentCategory.value
    ? categoryStore.getCategoryInfo(currentCategory.value)?.name ?? currentCategory.value
    : null
  if (currentSize.value === 'all') {
    return categoryName ? `Download all ${categoryName} snipes` : 'Download all snipes'
  }
  return categoryName
    ? `Download top ${currentSize.value} ${categoryName} snipes`
    : `Download top ${currentSize.value} snipes`
})

const metaTitle = computed(() => {
  if (!target.value) return undefined
  return `Snipe ${target.value.name} | AccSaber Reloaded`
})

usePageMeta({ title: metaTitle })

const filterCategoryId = computed(() => {
  if (!currentCategory.value) return null
  return categoryStore.getCategoryId(currentCategory.value) ?? null
})

const totalsKey = computed(() => filterCategoryId.value ?? 'all')

const snipeableCategoryIds = computed(() => {
  return snipeCategoryCodes.value
    .map((code) => categoryStore.getCategoryId(code))
    .filter((id): id is string => !!id)
})

function sumPlaysForScope(stats: UserAllStatisticsResponse | null): number {
  if (!stats) return 0
  if (filterCategoryId.value) {
    return stats.categories.find((c) => c.categoryId === filterCategoryId.value)?.rankedPlays ?? 0
  }
  const allowed = new Set(snipeableCategoryIds.value)
  return stats.categories
    .filter((c) => allowed.has(c.categoryId))
    .reduce((sum, c) => sum + c.rankedPlays, 0)
}

const sniperPlaysInScope = computed(() => sumPlaysForScope(sniperAllStats.value))
const targetPlaysInScope = computed(() => sumPlaysForScope(targetAllStats.value))

const totalMapsInScope = computed(() => rankedTotals.value.get(totalsKey.value) ?? 0)

const snipeable = computed(() => totalElements.value)

const sniperWinsCount = computed(() =>
  Math.max(0, sniperPlaysInScope.value - snipeable.value),
)
const targetWinsCount = computed(() =>
  Math.max(0, targetPlaysInScope.value - (reverseSnipeCount.value ?? 0)),
)
const unplayedCount = computed(() =>
  Math.max(0, totalMapsInScope.value - sniperWinsCount.value - targetWinsCount.value),
)

const tugReady = computed(
  () =>
    !!sniperAllStats.value &&
    !!targetAllStats.value &&
    reverseSnipeCount.value != null &&
    totalMapsInScope.value > 0,
)

async function fetchUsers() {
  if (!sniperId.value) return
  const [{ getUser, getUserLevel }, { getUserEquippedItems }] = await Promise.all([
    import('@/api/users'),
    import('@/api/items'),
  ])
  const [t, s, tl, sl, te, se] = await Promise.allSettled([
    getUser(targetId.value),
    getUser(sniperId.value),
    getUserLevel(targetId.value),
    getUserLevel(sniperId.value),
    getUserEquippedItems(targetId.value),
    getUserEquippedItems(sniperId.value),
  ])
  if (t.status === 'fulfilled') target.value = t.value
  if (s.status === 'fulfilled') sniper.value = s.value
  if (tl.status === 'fulfilled') targetLevel.value = tl.value
  if (sl.status === 'fulfilled') sniperLevel.value = sl.value
  targetEquipped.value = te.status === 'fulfilled' ? te.value : {}
  sniperEquipped.value = se.status === 'fulfilled' ? se.value : {}
}

async function fetchComparisons() {
  if (!sniperId.value) return
  loading.value = true
  try {
    const { getClosestScores } = await import('@/api/snipe')
    data.value = await getClosestScores(sniperId.value, targetId.value, {
      page: currentPage.value - 1,
      size: listSize.value,
      category: currentCategory.value || undefined,
    })
  } catch {
    data.value = null
  }
  loading.value = false
}

async function fetchAllStats() {
  if (!sniperId.value) return
  const { getUserAllStatistics } = await import('@/api/users')
  const [s, t] = await Promise.allSettled([
    getUserAllStatistics(sniperId.value),
    getUserAllStatistics(targetId.value),
  ])
  if (s.status === 'fulfilled') sniperAllStats.value = s.value
  if (t.status === 'fulfilled') targetAllStats.value = t.value
}

async function fetchTotalForCurrentScope() {
  const key = totalsKey.value
  if (rankedTotals.value.has(key)) return
  const { getDifficulties } = await import('@/api/maps')
  try {
    const page = await getDifficulties({
      status: 'RANKED',
      size: 1,
      categoryId: filterCategoryId.value ?? undefined,
    })
    const next = new Map(rankedTotals.value)
    next.set(key, page.totalElements ?? 0)
    rankedTotals.value = next
  } catch {
    /* swallow */
  }
}

async function fetchReverseSnipeCount() {
  if (!sniperId.value) return
  reverseSnipeCount.value = null
  try {
    const { getClosestScores } = await import('@/api/snipe')
    const res = await getClosestScores(targetId.value, sniperId.value, {
      page: 0,
      size: 1,
      category: currentCategory.value || undefined,
    })
    reverseSnipeCount.value = res.totalElements ?? 0
  } catch {
    reverseSnipeCount.value = 0
  }
}

async function refreshTugData() {
  tugLoading.value = true
  await Promise.allSettled([fetchTotalForCurrentScope(), fetchReverseSnipeCount()])
  tugLoading.value = false
}

function openDetail(score: ScoreResponse) {
  const categoryCode = categoryStore.getCategoryCode(score.categoryId)
  detailScore.value = toScoreDisplay(
    score,
    modifierStore.resolveModifierCodes(score.modifierIds),
    categoryCode,
  )
  detailUserId.value = score.userId
  detailOpen.value = true
}

const isValidPair = computed(
  () => !!sniperId.value && sniperId.value !== targetId.value,
)

watch(
  () => [sniperId.value, targetId.value] as const,
  () => {
    if (!isValidPair.value) {
      router.replace({ name: 'player-profile', params: { userId: targetId.value } })
      return
    }
    fetchUsers()
    sniperAllStats.value = null
    targetAllStats.value = null
    fetchAllStats()
  },
  { immediate: true },
)

watch(
  () => [sniperId.value, targetId.value, currentPage.value, currentSize.value, currentCategory.value] as const,
  () => {
    if (isValidPair.value) fetchComparisons()
  },
  { immediate: true },
)

watch(
  () => [sniperId.value, targetId.value, currentCategory.value] as const,
  () => {
    if (isValidPair.value) refreshTugData()
  },
  { immediate: true },
)
</script>

<template>
  <div class="snipe-page" :style="{ '--page-accent': heroAccent, '--accent': heroAccent }">
    <nav class="snipe-page__breadcrumbs" aria-label="Breadcrumb">
      <span class="snipe-page__breadcrumbs-pill">
        <router-link to="/leaderboards" class="snipe-page__crumb snipe-page__crumb--link">
          Leaderboards
          <span class="snipe-page__crumb-sep">/</span>
        </router-link>
        <router-link v-if="target" :to="`/players/${targetId}`" class="snipe-page__crumb snipe-page__crumb--link">
          {{ target.name }}
          <span class="snipe-page__crumb-sep">/</span>
        </router-link>
        <span class="snipe-page__crumb">Snipe</span>
      </span>
    </nav>

    <header class="snipe-hero">
      <div class="snipe-hero__player snipe-hero__player--sniper">
        <LevelBadge v-if="sniper" :level="sniperLevel?.level ?? 0"
          :current-xp="sniperLevel?.xpForCurrentLevel ?? 0" :required-xp="sniperLevel?.xpForNextLevel ?? 1"
          :avatar-url="sniperAvatar" :fallback-title="sniperLevel?.title" hide-progress
          :equipped-title="sniperTitle"
          :equipped-border-shape="sniperBorderShape"
          :equipped-border-color="sniperBorderColor" />
        <SkeletonLoader v-else variant="avatar" width="64px" height="64px" />
        <div class="snipe-hero__player-info">
          <span class="snipe-hero__role">You</span>
          <span class="snipe-hero__player-name">
            <CountryFlag v-if="sniper" :country="sniper.country" />
            {{ sniper?.name ?? '...' }}
            <SupporterTierIcon v-if="sniper?.supporterTier" :tier="sniper.supporterTier" :size="16" />
          </span>
        </div>
      </div>

      <div class="snipe-hero__vs" aria-hidden="true">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3" />
          <line x1="12" y1="2" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="2" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="22" y2="12" />
        </svg>
        <span class="snipe-hero__vs-label">Sniping</span>
      </div>

      <div class="snipe-hero__player snipe-hero__player--target">
        <LevelBadge v-if="target" :level="targetLevel?.level ?? 0"
          :current-xp="targetLevel?.xpForCurrentLevel ?? 0" :required-xp="targetLevel?.xpForNextLevel ?? 1"
          :avatar-url="targetAvatar" :fallback-title="targetLevel?.title" hide-progress
          :equipped-title="targetTitle"
          :equipped-border-shape="targetBorderShape"
          :equipped-border-color="targetBorderColor" />
        <SkeletonLoader v-else variant="avatar" width="64px" height="64px" />
        <div class="snipe-hero__player-info">
          <span class="snipe-hero__role snipe-hero__role--target">Target</span>
          <span class="snipe-hero__player-name">
            {{ target?.name ?? '...' }}
            <CountryFlag v-if="target" :country="target.country" />
            <SupporterTierIcon v-if="target?.supporterTier" :tier="target.supporterTier" :size="16" />
          </span>
        </div>
      </div>
    </header>

    <SnipeTugOfWar
      v-if="tugReady || tugLoading"
      :sniper-name="sniper?.name ?? 'You'"
      :sniper-country="sniper?.country"
      :sniper-wins="sniperWinsCount"
      :target-name="target?.name ?? 'Target'"
      :target-country="target?.country"
      :target-wins="targetWinsCount"
      :unplayed="unplayedCount"
      :loading="!tugReady && tugLoading"
    />

    <section class="snipe-page__summary">
      <header class="snipe-page__summary-caption">
        Based on {{ rows.length }} visible {{ rows.length === 1 ? 'map' : 'maps' }}:
      </header>
      <div class="snipe-page__summary-grid">
        <StatBlock label="Closest Gap" :value="`+${closestGapPct.toFixed(2)}%`" :accent-color="heroAccent" />
        <StatBlock label="Points to Gain" :value="totalPointsToGain" :decimals="0" />
        <StatBlock label="AP at Stake" :value="totalApAtStake" :decimals="2" />
      </div>
    </section>

    <section class="snipe-page__controls">
      <div class="snipe-page__filters">
        <BaseSelect :model-value="currentCategory" :options="categoryOptions" label="Category"
          @update:model-value="setCategory" />
        <BaseSelect :model-value="sizeSelectValue" :options="SIZE_OPTIONS" label="Page size"
          @update:model-value="setSize" />
      </div>
      <BaseButton class="snipe-page__download" variant="primary" size="lg" :href="playlistUrl"
        :disabled="!playlistUrl || rows.length === 0" aria-label="Download Beat Saber playlist">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
        <span>{{ downloadLabel }}</span>
      </BaseButton>
    </section>

    <section class="snipe-page__list">
      <template v-if="loading">
        <SkeletonLoader v-for="i in 5" :key="i" variant="card" height="160px" />
      </template>

      <template v-else-if="rows.length === 0">
        <EmptyState
          message="No close scores. You've already beaten this player on every overlapping map, or you have no scores in common." />
      </template>

      <template v-else>
        <SnipeComparisonRow v-for="comp in rows" :key="comp.mapDifficulty.id" :comparison="comp"
          :sniper-name="sniper?.name ?? 'You'" :target-name="target?.name ?? 'Target'"
          @open-detail="openDetail" />
      </template>
    </section>

    <PaginationControls v-if="totalPages > 1" :page="currentPage" :total-pages="totalPages"
      @update:page="setPage" />

    <ScoreDetailModal :open="detailOpen" :score="detailScore" :user-id="detailUserId"
      @close="detailOpen = false" />
  </div>
</template>

<style scoped>
.snipe-page {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-lg);
  --accent: var(--page-accent, var(--accent-overall));
}

.snipe-page > * {
  width: 100%;
  max-width: 1080px;
  position: relative;
  z-index: 1;
}

.snipe-page__breadcrumbs {
  display: flex;
  align-items: center;
}

.snipe-page__breadcrumbs-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-md);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-pill);
}

.snipe-page__crumb {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
}

.snipe-page__crumb--link {
  color: var(--text-secondary);
  transition: color 120ms ease;
}

.snipe-page__crumb--link:hover {
  color: var(--accent);
}

.snipe-page__crumb-sep {
  color: var(--text-tertiary);
}

.snipe-hero {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--space-lg);
  padding: var(--space-lg);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
}

.snipe-hero__player {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  min-width: 0;
}

.snipe-hero__player--target {
  flex-direction: row-reverse;
  text-align: right;
}

.snipe-hero__player-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.snipe-hero__role {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.snipe-hero__role--target {
  color: var(--accent);
}

.snipe-hero__player-name {
  font-size: var(--text-section-heading);
  font-weight: 600;
  color: var(--text-primary);
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.snipe-hero__vs {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  color: var(--accent);
}

.snipe-hero__vs-label {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.snipe-page__summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  padding: var(--space-sm) var(--space-md);
}

.snipe-page__summary-caption {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: center;
}

.snipe-page__summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-md);
  justify-items: center;
}

.snipe-page__controls {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.snipe-page__filters {
  display: flex;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.snipe-page__download {
  --accent: var(--accent-overall);
}

.snipe-page__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

@media (max-width: 768px) {
  .snipe-hero {
    grid-template-columns: 1fr;
    text-align: center;
  }

  .snipe-hero__player,
  .snipe-hero__player--target {
    flex-direction: column;
    text-align: center;
  }

  .snipe-page__summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .snipe-page__controls {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
