<script setup lang="ts">
import BaseSelect from '@/components/common/BaseSelect.vue'
import DataTable from '@/components/common/DataTable.vue'
import GlowImage from '@/components/common/GlowImage.vue'
import PaginationControls from '@/components/common/PaginationControls.vue'
import RankChange from '@/components/common/RankChange.vue'
import SearchBox from '@/components/common/SearchBox.vue'
import CategoryTabs from '@/components/domain/CategoryTabs.vue'
import CountryFlag from '@/components/domain/CountryFlag.vue'
import RelationFilter from '@/components/domain/RelationFilter.vue'
import SupporterTierIcon from '@/components/domain/SupporterTierIcon.vue'
import { usePageMeta } from '@/composables/usePageMeta'
import { usePageableRoute } from '@/composables/usePageableRoute'
import { useAuthStore } from '@/stores/auth'
import { useCategoryStore } from '@/stores/categories'
import { useLeaderboardCacheStore } from '@/stores/leaderboardCache'
import { useLevelStore } from '@/stores/levels'
import type { UserRelationType } from '@/types/api/relations'
import type { SupporterTier } from '@/types/api/supporters'
import type { LeaderboardResponse, XpLeaderboardResponse } from '@/types/api/users'
import type { CategoryCode, TableColumn } from '@/types/display'
import type { Page } from '@/types/pagination'
import { COUNTRY_OPTIONS } from '@/utils/countries'
import { toPlayerDisplay, toXpPlayerDisplay } from '@/utils/mappers'
import { getRankClass } from '@/utils/ranking'
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const categoryStore = useCategoryStore()
const lbCache = useLeaderboardCacheStore()
const levelStore = useLevelStore()

const activeCategory = computed<CategoryCode>({
  get: () => (route.params.categoryCode as CategoryCode) || 'overall',
  set: (code) => {
    const query = { ...route.query }
    delete query.page
    delete query.sort
    delete query.order
    router.push({ name: 'leaderboards-category', params: { categoryCode: code }, query })
  },
})

const isXpMode = computed(() => activeCategory.value === 'xp')

const metaTitle = computed(() => {
  const info = categoryStore.getCategoryInfo(activeCategory.value)
  const name = info?.name ?? 'Overall'
  return `${name} Leaderboard | AccSaber`
})

usePageMeta({
  title: metaTitle,
  description: 'AccSaber accuracy leaderboards - compete across True Acc, Standard Acc, Tech Acc, and more.',
})

const { currentPage, sortState, paginationParams, setPage, setSort, resetPage } = usePageableRoute({
  defaultSort: computed(() => isXpMode.value ? 'totalXp' : 'ap'),
  defaultOrder: 'desc',
  defaultSize: 50,
  sortFieldMap: { avgAccuracy: 'averageAcc' },
  secondarySort: computed(() => isXpMode.value ? null : 'ap,desc'),
})

const accent = computed(() => categoryStore.getAccent(activeCategory.value))
const categoryName = computed(() =>
  categoryStore.getCategoryInfo(activeCategory.value)?.name ?? 'Leaderboards',
)

const countryFilter = computed<string>({
  get: () => (route.query.country as string) || '',
  set: (country) => {
    const query = { ...route.query }
    if (country) {
      query.country = country
    } else {
      delete query.country
    }
    delete query.page
    router.replace({ query })
  },
})

const relationFilter = computed<UserRelationType | ''>({
  get: () => (route.query.relation as UserRelationType | '') || '',
  set: (relation) => {
    const query = { ...route.query }
    if (relation) {
      query.relation = relation
    } else {
      delete query.relation
    }
    delete query.page
    router.replace({ query })
  },
})

const searchQuery = ref('')
const showInactive = ref(true)
const loading = ref(false)
const apPageData = ref<Page<LeaderboardResponse> | null>(null)
const xpPageData = ref<Page<XpLeaderboardResponse> | null>(null)
const highlightedUserId = ref<string | null>(null)

interface RankResolution {
  globalRank: number
  countryRank: number | undefined
  positionalRank: number
}

interface RankFilters {
  filteringCountry: boolean
  filteringRelation: boolean
  inactiveHidden: boolean
}

function resolveDisplayRank(r: RankResolution, f: RankFilters): { rank: number; parenRank: number | null } {
  if (f.filteringRelation) {
    return { rank: r.positionalRank, parenRank: r.globalRank }
  }
  if (f.filteringCountry) {
    return {
      rank: f.inactiveHidden || !r.countryRank ? r.positionalRank : r.countryRank,
      parenRank: r.globalRank,
    }
  }
  if (f.inactiveHidden) {
    return { rank: r.positionalRank, parenRank: r.globalRank }
  }
  return { rank: r.globalRank, parenRank: null }
}

const rows = computed<Record<string, unknown>[]>(() => {
  const pageSize = paginationParams.value.size ?? 50
  const pageOffset = (currentPage.value - 1) * pageSize
  const filters: RankFilters = {
    inactiveHidden: !showInactive.value,
    filteringCountry: !!countryFilter.value,
    filteringRelation: !!relationFilter.value,
  }

  const source = isXpMode.value ? xpPageData.value : apPageData.value
  if (!source) return []

  return source.content.map((entry, i) => {
    const p = isXpMode.value
      ? toXpPlayerDisplay(entry as XpLeaderboardResponse)
      : toPlayerDisplay(entry as LeaderboardResponse)
    const { rank, parenRank } = resolveDisplayRank(
      { globalRank: p.rank, countryRank: p.countryRank, positionalRank: pageOffset + i + 1 },
      filters,
    )
    return { ...p, rank, parenRank }
  })
})

const pageData = computed(() => isXpMode.value ? xpPageData.value : apPageData.value)
const totalPages = computed(() => pageData.value?.totalPages ?? 0)
const totalPlayers = computed(() => pageData.value?.totalElements ?? 0)

const rankChangeColumn: TableColumn = { key: 'rankChange', label: '', align: 'center', width: '70px' }

const apColumns: TableColumn[] = [
  { key: 'rank', label: 'Rank', align: 'right', mono: true, width: '80px' },
  { key: 'player', label: 'Player', align: 'left' },
  { key: 'ap', label: 'AP', sortable: true, align: 'right', mono: true, width: '120px' },
  { key: 'avgAccuracy', label: 'Avg Acc', sortable: true, align: 'right', mono: true, width: '120px' },
  { key: 'rankedPlays', label: 'Plays', sortable: true, align: 'right', mono: true, width: '100px' },
  rankChangeColumn,
]

const xpColumns: TableColumn[] = [
  { key: 'rank', label: 'Rank', align: 'right', mono: true, width: '80px' },
  { key: 'player', label: 'Player', align: 'left' },
  { key: 'level', label: 'Level', sortable: true, align: 'right', mono: true, width: '100px' },
  { key: 'totalXp', label: 'Total XP', sortable: true, align: 'right', mono: true, width: '140px' },
  rankChangeColumn,
]

const columns = computed(() => isXpMode.value ? xpColumns : apColumns)

const countryOptions = computed(() => {
  const userCountry = authStore.userProfile?.country
  if (!userCountry) return COUNTRY_OPTIONS
  const userOption = COUNTRY_OPTIONS.find((o) => o.value === userCountry)
  if (!userOption) return COUNTRY_OPTIONS
  return [
    { value: '', label: 'All Countries' },
    userOption,
    ...COUNTRY_OPTIONS.filter((o) => o.value !== '' && o.value !== userCountry),
  ]
})

function buildCacheKey(): Record<string, unknown> {
  const inactiveUsers = showInactive.value
  const relation = relationFilter.value || undefined
  if (isXpMode.value) {
    return {
      _type: 'xp',
      ...paginationParams.value,
      search: searchQuery.value.trim() || undefined,
      country: countryFilter.value || undefined,
      inactiveUsers,
      relation,
    }
  }
  return {
    _type: 'ap',
    category: activeCategory.value,
    ...paginationParams.value,
    search: searchQuery.value.trim() || undefined,
    country: countryFilter.value || undefined,
    inactiveUsers,
    relation,
  }
}

async function fetchData() {
  const cacheKey = buildCacheKey()
  const cached = lbCache.getCached<Page<LeaderboardResponse> | Page<XpLeaderboardResponse>>(cacheKey)

  if (cached) {
    if (isXpMode.value) {
      xpPageData.value = cached as Page<XpLeaderboardResponse>
    } else {
      apPageData.value = cached as Page<LeaderboardResponse>
    }
    loading.value = false
    try {
      await fetchFromApi(cacheKey)
    } catch { }
    await handleHighlight()
    return
  }

  loading.value = true
  try {
    await fetchFromApi(cacheKey)
  } catch {
    if (isXpMode.value) {
      xpPageData.value = null
    } else {
      apPageData.value = null
    }
  }
  loading.value = false
  await handleHighlight()
}

async function fetchFromApi(cacheKey: Record<string, unknown>) {
  const inactiveUsers = showInactive.value
  const relation = relationFilter.value || undefined
  if (isXpMode.value) {
    const { getXpLeaderboard } = await import('@/api/leaderboards')
    const params = {
      ...paginationParams.value,
      search: searchQuery.value.trim() || undefined,
      country: countryFilter.value || undefined,
      inactiveUsers,
      relation,
    }
    const res = await getXpLeaderboard(params)
    xpPageData.value = res
    lbCache.setCache(cacheKey, res)
  } else {
    const categoryId = categoryStore.getCategoryId(activeCategory.value)
    if (!categoryId) return
    const { getLeaderboard } = await import('@/api/leaderboards')
    const params = {
      ...paginationParams.value,
      search: searchQuery.value.trim() || undefined,
      country: countryFilter.value || undefined,
      inactiveUsers,
      relation,
    }
    const res: Page<LeaderboardResponse> = await getLeaderboard(categoryId, params)
    apPageData.value = res
    lbCache.setCache(cacheKey, res)
  }
}

async function handleHighlight() {
  const highlightId = route.query.highlight as string | undefined
  if (highlightId) {
    highlightedUserId.value = highlightId
    router.replace({ query: { ...route.query, highlight: undefined } })
    await nextTick()
    const row = document.querySelector(`[data-user-id="${highlightId}"]`)
    if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => { highlightedUserId.value = null }, 2000)
  }
}

function rowClass(row: Record<string, unknown>): Record<string, boolean> {
  return {
    'data-table__row--highlighted': row.userId === highlightedUserId.value,
    'data-table__row--self-highlight': !!authStore.userId && row.userId === authStore.userId,
    'data-table__row--inactive': !!row.playerInactive,
  }
}

function playerRowTo(row: Record<string, unknown>) {
  const query: Record<string, string> = {}
  if (activeCategory.value && activeCategory.value !== 'overall' && activeCategory.value !== 'xp') {
    query.category = activeCategory.value
  }
  return { name: 'player-profile', params: { userId: row.userId as string }, query }
}

function handleRowClick(row: Record<string, unknown>) {
  router.push(playerRowTo(row))
}

function handleCategoryChange(code: CategoryCode) {
  activeCategory.value = code
}

function handleCountryChange(country: string) {
  countryFilter.value = country
}

watch(searchQuery, () => { resetPage() })

watch(
  [activeCategory, paginationParams, countryFilter, searchQuery, showInactive, relationFilter],
  () => { fetchData() },
  { immediate: true },
)

watch(() => categoryStore.loaded, (loaded) => {
  if (loaded) fetchData()
})
</script>

<template>
  <div class="leaderboards" :style="{ '--page-accent': accent }">
    <header class="leaderboards__header">
      <div class="leaderboards__header-content">
        <h1 class="leaderboards__title">{{ categoryName }}</h1>
        <p v-if="totalPlayers > 0" class="leaderboards__subtitle">
          {{ totalPlayers.toLocaleString() }} players ranked
        </p>
      </div>
    </header>

    <div class="leaderboards__controls">
      <CategoryTabs :model-value="activeCategory" @update:model-value="handleCategoryChange" />
      <div class="leaderboards__filter">
        <button class="leaderboards__inactive-toggle" :class="{ 'leaderboards__inactive-toggle--active': showInactive }"
          :aria-pressed="showInactive" aria-label="Show inactive players" @click="showInactive = !showInactive">
          <span class="leaderboards__inactive-track">
            <span class="leaderboards__inactive-thumb" />
          </span>
          <span class="leaderboards__inactive-label">Inactive</span>
        </button>
        <SearchBox v-model="searchQuery" placeholder="Search players..." />
        <BaseSelect :model-value="countryFilter" :options="countryOptions" placeholder="All Countries" searchable
          @update:model-value="handleCountryChange" />
        <RelationFilter v-model="relationFilter" />
      </div>
    </div>

    <PaginationControls v-if="totalPages > 1" :page="currentPage" :total-pages="totalPages" @update:page="setPage" />

    <div class="leaderboards__table">
      <DataTable :columns="columns" :rows="rows" :sort-state="sortState" :loading="loading" :loading-rows="10"
        :row-class="rowClass" row-clickable :row-to="playerRowTo" row-key="userId" empty-message="No players found"
        @sort="setSort" @row-click="handleRowClick">
        <template #cell-rank="{ value, row }">
          <span class="rank-cell" :class="getRankClass(value as number)">
            #{{ value }}
            <span v-if="row.parenRank" class="rank-cell__global">(#{{ row.parenRank }})</span>
          </span>
        </template>

        <template #cell-rankChange="{ row }">
          <RankChange :value="(row.rankChange as number) ?? 0" />
        </template>

        <template #cell-player="{ row }">
          <div class="player-cell" :data-user-id="row.userId">
            <GlowImage :src="(row.avatarUrl as string)" :alt="(row.name as string)" :size="32"
              :fallback-src="(row.avatarFallbackUrl as string | null | undefined) ?? null" />
            <span class="player-cell__name">{{ row.name }}</span>
            <CountryFlag :country="(row.country as string)" />
            <SupporterTierIcon v-if="row.supporterTier" :tier="(row.supporterTier as SupporterTier)" />
          </div>
        </template>

        <template #cell-ap="{ value }">
          <span class="ap-cell">{{ (value as number).toFixed(2) }}</span>
        </template>

        <template #cell-avgAccuracy="{ value }">
          <template v-if="value != null">
            {{ ((value as number) * 100).toFixed(2) }}%
          </template>
          <template v-else>-</template>
        </template>

        <template #cell-totalXp="{ value, row }">
          <span class="xp-cell" :style="{ color: levelStore.getTierColorForLevel(row.level as number) }"
            :title="levelStore.getTitleForLevel(row.level as number) ?? undefined">
            {{ Math.round(value as number).toLocaleString() }}
          </span>
        </template>

        <template #mobile-card="{ row }">
          <router-link :to="playerRowTo(row)" class="lb-card" :class="[
            { 'lb-card--highlighted': row.userId === highlightedUserId },
            { 'lb-card--self-highlight': !!authStore.userId && row.userId === authStore.userId },
            { 'lb-card--inactive': !!row.playerInactive },
          ]" :data-user-id="row.userId">
            <span class="lb-card__rank rank-cell" :class="getRankClass(row.rank as number)">
              #{{ row.rank }}
              <span v-if="row.parenRank" class="rank-cell__global">(#{{ row.parenRank }})</span>
            </span>
            <div class="lb-card__player">
              <GlowImage :src="(row.avatarUrl as string)" :alt="(row.name as string)" :size="28"
                :fallback-src="(row.avatarFallbackUrl as string | null | undefined) ?? null" />
              <span class="lb-card__name">{{ row.name }}</span>
              <CountryFlag :country="(row.country as string)" />
              <SupporterTierIcon v-if="row.supporterTier" :tier="(row.supporterTier as SupporterTier)" />
            </div>
            <RankChange :value="(row.rankChange as number) ?? 0" class="lb-card__change" />
            <template v-if="isXpMode">
              <span class="lb-card__level">Lv. {{ row.level }}</span>
              <span class="lb-card__ap xp-cell"
                :style="{ color: levelStore.getTierColorForLevel(row.level as number) }"
                :title="levelStore.getTitleForLevel(row.level as number) ?? undefined">
                {{ Math.round(row.totalXp as number).toLocaleString() }} XP
              </span>
            </template>
            <span v-else class="lb-card__ap ap-cell">{{ (row.ap as number).toFixed(2) }}</span>
          </router-link>
        </template>
      </DataTable>
    </div>

    <PaginationControls v-if="totalPages > 1" :page="currentPage" :total-pages="totalPages" @update:page="setPage" />
  </div>
</template>

<style scoped>
.leaderboards {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  max-width: 1080px;
  margin: 0 auto;
  width: 100%;
}

.leaderboards__header {
  position: relative;
  text-align: center;
  padding: var(--space-2xl) 0 var(--space-lg);
}

.leaderboards__header-content {
  position: relative;
}

.leaderboards__title {
  font-size: var(--text-page-title);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.leaderboards__subtitle {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  margin: var(--space-xs) 0 0;
  letter-spacing: 0.02em;
}

.leaderboards__controls {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: var(--space-md);
  flex-wrap: wrap;
  row-gap: var(--space-md);
}

.leaderboards__inactive-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  background: none;
  border: none;
  padding: 0;
  font: inherit;
}

.leaderboards__inactive-track {
  position: relative;
  width: 28px;
  height: 16px;
  border-radius: 8px;
  background: var(--bg-overlay);
  border: 1px solid var(--text-tertiary);
  transition: background 120ms ease, border-color 120ms ease;
}

.leaderboards__inactive-toggle--active .leaderboards__inactive-track {
  background: color-mix(in srgb, var(--page-accent) 40%, transparent);
  border-color: var(--page-accent);
}

.leaderboards__inactive-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--text-tertiary);
  transition: transform 120ms ease, background 120ms ease;
}

.leaderboards__inactive-toggle--active .leaderboards__inactive-thumb {
  transform: translateX(12px);
  background: var(--page-accent);
}

.leaderboards__inactive-label {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  user-select: none;
}

.leaderboards__filter {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.leaderboards__table {
  --accent: var(--page-accent);
}

.rank-cell {
  font-family: var(--font-mono);
  font-weight: 500;
  color: var(--text-secondary);
}

.rank-cell.rank--gold {
  color: var(--tier-gold);
  font-weight: 700;
}

.rank-cell.rank--silver {
  color: var(--tier-silver);
  font-weight: 700;
}

.rank-cell.rank--bronze {
  color: var(--tier-bronze);
  font-weight: 700;
}

.rank-cell__global {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  font-weight: 400;
  margin-left: 2px;
}

:deep(.data-table__row--highlighted) {
  animation: row-highlight 2s ease-out;
}

:deep(.data-table__row--self-highlight) {
  background: color-mix(in srgb, var(--page-accent) 8%, var(--bg-surface));
  border-left: 2px solid color-mix(in srgb, var(--page-accent) 40%, transparent);
}

:deep(.data-table__row--inactive) {}

@keyframes row-highlight {
  0% {
    background: color-mix(in srgb, var(--page-accent) 25%, var(--bg-surface));
    border-left-color: var(--page-accent);
  }

  100% {
    background: transparent;
    border-left-color: transparent;
  }
}

.player-cell {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-width: 0;
}

.player-cell__name {
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.ap-cell {
  color: var(--page-accent);
  font-weight: 600;
}

.xp-cell {
  font-weight: 600;
  transition: color 120ms ease;
}

.lb-card {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-left: 2px solid transparent;
  border-radius: var(--radius-card);
  cursor: pointer;
  min-height: 48px;
  transition: border-color 120ms ease;
  text-decoration: none;
  color: inherit;
}

.lb-card:hover {
  border-left-color: var(--page-accent);
}

.lb-card__rank {
  width: 36px;
  text-align: right;
  flex-shrink: 0;
}

.lb-card__player {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
}

.lb-card__name {
  flex: 1;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lb-card__ap {
  font-family: var(--font-mono);
  font-weight: 600;
  flex-shrink: 0;
}

.lb-card__level {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  font-weight: 600;
  flex-shrink: 0;
  transition: color 120ms ease;
}

.lb-card--highlighted {
  animation: row-highlight 2s ease-out;
}

.lb-card--self-highlight {
  background: color-mix(in srgb, var(--page-accent) 8%, var(--bg-surface));
  border-left-color: color-mix(in srgb, var(--page-accent) 40%, transparent);
}

.lb-card--inactive {}

@media (max-width: 767px) {
  .leaderboards__controls {
    flex-direction: column;
    align-items: stretch;
  }

  .leaderboards__filter {
    min-width: unset;
  }

  .leaderboards__header {
    padding: var(--space-lg) 0 var(--space-md);
  }
}
</style>
