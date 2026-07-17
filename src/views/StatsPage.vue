<script setup lang="ts">
import BaseSelect from '@/components/common/BaseSelect.vue'
import PaginationControls from '@/components/common/PaginationControls.vue'
import CategoryTabs from '@/components/domain/CategoryTabs.vue'
import ScoreDetailModal from '@/components/domain/ScoreDetailModal.vue'
import { usePageMeta } from '@/composables/usePageMeta'
import { usePageableRoute } from '@/composables/usePageableRoute'
import { useAuthStore } from '@/stores/auth'
import { useCategoryStore } from '@/stores/categories'
import { useModifierStore } from '@/stores/modifiers'
import type { ScoreResponse } from '@/types/api/users'
import type { CategoryCode, ScoreDisplay, TableColumn } from '@/types/display'
import type { Page } from '@/types/pagination'
import { COUNTRY_OPTIONS } from '@/utils/countries'
import { toScoreDisplay } from '@/utils/mappers'
import { loadStoredCountry, storeCountry } from '@/utils/statsCountry'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ItemStatsSection from './stats/ItemStatsSection.vue'
import LeaderboardPicker from './stats/LeaderboardPicker.vue'
import LeaderboardTable from './stats/LeaderboardTable.vue'
import PlatformGrowthSection from './stats/PlatformGrowthSection.vue'
import SectionToggle from './stats/SectionToggle.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const categoryStore = useCategoryStore()
const modifierStore = useModifierStore()

usePageMeta({
  title: 'Stats | AccSaber',
  description: 'Platform-wide statistics, leaderboards, and score distributions across AccSaber.',
})

type SectionKey = 'leaderboards' | 'items' | 'platform'
type LeaderboardTab = 'streaks' | 'max-ap' | 'avg-ap' | 'most-retried' | 'grinders' | 'dedication' | 'collectors'

const leaderboardOptions: { key: LeaderboardTab; label: string; icon: string; description: string }[] = [
  { key: 'streaks', label: 'Longest Streaks', icon: 'streak', description: 'Highest 115 streaks' },
  { key: 'max-ap', label: 'Highest AP', icon: 'star', description: 'Top single-score AP' },
  { key: 'avg-ap', label: 'Most Worth Maps', icon: 'mountain', description: 'Highest average AP' },
  { key: 'most-retried', label: 'Most Grinded Maps', icon: 'repeat', description: 'Most superseded scores' },
  { key: 'grinders', label: 'Top Grinders', icon: 'trending', description: 'Most improvements overall' },
  { key: 'dedication', label: 'Map Dedication', icon: 'target', description: 'Most improvements on one map' },
  { key: 'collectors', label: 'Milestone Collectors', icon: 'trophy', description: 'Most milestones earned' },
]

const TABS_WITH_CATEGORY = new Set<LeaderboardTab>([
  'streaks', 'max-ap', 'avg-ap', 'most-retried', 'grinders', 'dedication',
])

const DEFAULT_SORTS: Record<LeaderboardTab, string> = {
  'streaks': 'streak115', 'max-ap': 'ap', 'avg-ap': 'averageWeightedAp',
  'most-retried': 'supersededCount', 'grinders': 'improvementCount',
  'dedication': 'improvementCount', 'collectors': 'milestoneCount',
}

const activeSection = computed<SectionKey>({
  get: () => (route.query.section as SectionKey) || 'leaderboards',
  set: (section) => {
    router.push({ query: { section: section === 'leaderboards' ? undefined : section } })
  },
})

const activeTab = computed<LeaderboardTab>({
  get: () => (route.query.tab as LeaderboardTab) || 'streaks',
  set: (tab) => {
    const query: Record<string, string> = { tab }
    if (route.query.section) query.section = route.query.section as string
    if (route.query.category) query.category = route.query.category as string
    if (route.query.country) query.country = route.query.country as string
    router.push({ query })
  },
})

const activeCategory = computed<CategoryCode>({
  get: () => (route.query.category as CategoryCode) || 'overall',
  set: (code) => {
    const query: Record<string, unknown> = { ...route.query, category: code }
    delete query.page
    router.push({ query: query as Record<string, string> })
  },
})

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
    storeCountry(country)
    router.replace({ query })
  },
})

onMounted(() => {
  if (!route.query.country) {
    const persisted = loadStoredCountry()
    if (persisted) {
      router.replace({ query: { ...route.query, country: persisted } })
    }
  }
})

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

const { currentPage, paginationParams, setPage } = usePageableRoute({
  defaultSort: computed(() => DEFAULT_SORTS[activeTab.value] ?? 'streak115'),
  defaultOrder: 'desc',
  defaultSize: 50,
})

const accent = computed(() => categoryStore.getAccent(activeCategory.value))
const isScoreTab = computed(() => activeTab.value === 'streaks' || activeTab.value === 'max-ap')

const SECTION_TITLES: Record<SectionKey, string> = {
  leaderboards: 'Extra Leaderboards',
  items: 'Item Stats',
  platform: 'Platform Stats',
}
const sectionTitle = computed(() => SECTION_TITLES[activeSection.value])

const detailColumn: TableColumn = { key: 'detail', label: '', width: '44px', align: 'center', noLink: true }

const COLUMNS: Record<LeaderboardTab, TableColumn[]> = {
  'streaks': [
    { key: 'rank', label: '#', align: 'right', mono: true, width: '60px' },
    { key: 'player', label: 'Player', align: 'left' },
    { key: 'map', label: 'Map', align: 'left' },
    { key: 'streak115', label: 'Streak', align: 'right', mono: true, width: '100px' },
    { key: 'accuracy', label: 'Accuracy', align: 'right', mono: true, width: '110px' },
    { key: 'ap', label: 'AP', align: 'right', mono: true, width: '100px' },
    { key: 'timeSet', label: 'Date', align: 'right', width: '110px' },
    detailColumn,
  ],
  'max-ap': [
    { key: 'rank', label: '#', align: 'right', mono: true, width: '60px' },
    { key: 'player', label: 'Player', align: 'left' },
    { key: 'map', label: 'Map', align: 'left' },
    { key: 'ap', label: 'AP', align: 'right', mono: true, width: '100px' },
    { key: 'accuracy', label: 'Accuracy', align: 'right', mono: true, width: '110px' },
    { key: 'timeSet', label: 'Date', align: 'right', width: '110px' },
    detailColumn,
  ],
  'avg-ap': [
    { key: 'rank', label: '#', align: 'right', mono: true, width: '60px' },
    { key: 'map', label: 'Map', align: 'left' },
    { key: 'categoryName', label: 'Category', align: 'left', width: '130px' },
    { key: 'averageWeightedAp', label: 'Avg AP', align: 'right', mono: true, width: '110px' },
    { key: 'scoreCount', label: 'Scores', align: 'right', mono: true, width: '100px' },
    { key: 'latestScoreTimeSet', label: 'Latest', align: 'right', width: '110px' },
  ],
  'most-retried': [
    { key: 'rank', label: '#', align: 'right', mono: true, width: '60px' },
    { key: 'map', label: 'Map', align: 'left' },
    { key: 'categoryName', label: 'Category', align: 'left', width: '130px' },
    { key: 'supersededCount', label: 'Retries', align: 'right', mono: true, width: '110px' },
    { key: 'latestScoreTimeSet', label: 'Latest', align: 'right', width: '110px' },
  ],
  'grinders': [
    { key: 'rank', label: '#', align: 'right', mono: true, width: '60px' },
    { key: 'player', label: 'Player', align: 'left' },
    { key: 'improvementCount', label: 'Improvements', align: 'right', mono: true, width: '140px' },
    { key: 'latestScoreTimeSet', label: 'Latest', align: 'right', width: '110px' },
  ],
  'dedication': [
    { key: 'rank', label: '#', align: 'right', mono: true, width: '60px' },
    { key: 'player', label: 'Player', align: 'left' },
    { key: 'map', label: 'Map', align: 'left' },
    { key: 'improvementCount', label: 'Improvements', align: 'right', mono: true, width: '140px' },
    { key: 'latestScoreTimeSet', label: 'Latest', align: 'right', width: '110px' },
  ],
  'collectors': [
    { key: 'rank', label: '#', align: 'right', mono: true, width: '60px' },
    { key: 'player', label: 'Player', align: 'left' },
    { key: 'milestoneCount', label: 'Milestones', align: 'right', mono: true, width: '140px' },
  ],
}

const columns = computed(() => COLUMNS[activeTab.value] ?? [])

const loading = ref(false)
const pageData = ref<Page<unknown> | null>(null)
const scoreResponses = ref<ScoreResponse[]>([])
const detailOpen = ref(false)
const detailScore = ref<ScoreDisplay | null>(null)
const detailUserId = ref('')

function openScoreDetail(scoreId: string) {
  const raw = scoreResponses.value.find((s) => s.id === scoreId)
  if (!raw) return
  detailScore.value = toScoreDisplay(raw, modifierStore.resolveModifierCodes(raw.modifierIds), categoryStore.getCategoryCode(raw.categoryId))
  detailUserId.value = raw.userId
  detailOpen.value = true
}

function addRank(item: Record<string, unknown>, index: number) {
  const cdnAvatar = item.cdnAvatarUrl as string | null | undefined
  const upstreamAvatar = item.avatarUrl as string | null | undefined
  const resolvedAvatar = cdnAvatar ?? upstreamAvatar ?? ''
  const fallbackAvatar = cdnAvatar && upstreamAvatar && cdnAvatar !== upstreamAvatar ? upstreamAvatar : null
  const cdnCover = item.cdnCoverUrl as string | null | undefined
  const upstreamCover = item.coverUrl as string | null | undefined
  const resolvedCover = cdnCover ?? upstreamCover ?? ''
  const fallbackCover = cdnCover && upstreamCover && cdnCover !== upstreamCover ? upstreamCover : null
  return {
    ...item,
    avatarUrl: resolvedAvatar,
    avatarFallbackUrl: fallbackAvatar,
    coverUrl: resolvedCover,
    coverFallbackUrl: fallbackCover,
    rank: pageData.value!.number * pageData.value!.size + index + 1,
  }
}

const rows = computed<Record<string, unknown>[]>(() => {
  if (!pageData.value) return []
  return pageData.value.content.map((item, i) => addRank(item as Record<string, unknown>, i))
})

const hasSupersededRows = computed(() => isScoreTab.value && rows.value.some((r) => r.active === false))
const totalPages = computed(() => pageData.value?.totalPages ?? 0)
const totalElements = computed(() => pageData.value?.totalElements ?? 0)

let lbRequestId = 0

async function fetchLeaderboardData() {
  const requestId = ++lbRequestId
  loading.value = true
  try {
    const categoryId = TABS_WITH_CATEGORY.has(activeTab.value) && activeCategory.value !== 'overall'
      ? categoryStore.getCategoryId(activeCategory.value) : undefined
    const country = countryFilter.value || undefined
    const params = paginationParams.value
    const api = await import('@/api/statistics')
    let result: Page<unknown>

    switch (activeTab.value) {
      case 'streaks': result = await api.getStreakLeaderboard(params, categoryId, country); break
      case 'max-ap': result = await api.getMaxApLeaderboard(params, categoryId, country); break
      case 'avg-ap': result = await api.getHighestAvgApMaps(params, categoryId, undefined, country); break
      case 'most-retried': result = await api.getMostRetriedMaps(params, categoryId, country); break
      case 'grinders': result = await api.getMostImprovements(params, categoryId, country); break
      case 'dedication': result = await api.getMostMapImprovements(params, categoryId, country); break
      case 'collectors': result = await api.getMilestoneCollectors(params, country); break
      default: result = { content: [], totalElements: 0, totalPages: 0, size: 0, number: 0, first: true, last: true, empty: true }
    }

    if (requestId !== lbRequestId) return
    if (isScoreTab.value) scoreResponses.value = result.content as ScoreResponse[]
    pageData.value = result
  } catch (error) {
    if (requestId !== lbRequestId) return
    console.error('Failed to fetch leaderboard:', error)
    pageData.value = null
  }
  loading.value = false
}

watch(
  [activeTab, activeCategory, countryFilter, paginationParams],
  () => { if (activeSection.value === 'leaderboards') fetchLeaderboardData() },
  { immediate: true },
)
watch(() => categoryStore.loaded, (loaded, wasLoaded) => {
  if (loaded && !wasLoaded && activeSection.value === 'leaderboards') fetchLeaderboardData()
})
</script>

<template>
  <div class="stats" :style="{ '--page-accent': accent }">
    <header class="stats__header">
      <div class="stats__header-content">
        <h1 class="stats__title">{{ sectionTitle }}</h1>
        <p v-if="activeSection === 'leaderboards' && totalElements > 0" class="stats__subtitle">
          {{ totalElements.toLocaleString() }} records
        </p>
      </div>
    </header>

    <SectionToggle v-model="activeSection" />

    <template v-if="activeSection === 'leaderboards'">
      <div class="stats__category-filter">
        <CategoryTabs :model-value="activeCategory" :exclude="['xp']" @update:model-value="activeCategory = $event" />
        <BaseSelect :model-value="countryFilter" :options="countryOptions" placeholder="All Countries" searchable
          @update:model-value="countryFilter = $event" />
      </div>

      <LeaderboardPicker v-model="activeTab" :options="leaderboardOptions" />

      <div v-if="hasSupersededRows" class="stats__disclaimer">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <p>Dimmed rows indicate scores that have been superseded by a newer score on the same map.</p>
      </div>

      <div class="stats__table" :style="{ '--accent': accent }">
        <LeaderboardTable :columns="columns" :rows="rows" :loading="loading" :active-tab="activeTab"
          @score-detail="openScoreDetail" />
      </div>

      <PaginationControls v-if="totalPages > 1" :page="currentPage" :total-pages="totalPages" @update:page="setPage" />

      <ScoreDetailModal :open="detailOpen" :score="detailScore" :user-id="detailUserId" @close="detailOpen = false" />
    </template>

    <ItemStatsSection v-else-if="activeSection === 'items'" :accent="accent" :country-options="countryOptions" />

    <PlatformGrowthSection v-else :accent="accent" />
  </div>
</template>

<style scoped>
.stats {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  max-width: 1030px;
  margin: 0 auto;
  width: 100%;
}

.stats__header {
  position: relative;
  text-align: center;
  padding: var(--space-2xl) 0 var(--space-lg);
}

.stats__header-content {
  position: relative;
}

.stats__title {
  font-size: var(--text-page-title);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.stats__subtitle {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  margin: var(--space-xs) 0 0;
  letter-spacing: 0.02em;
}

.stats__category-filter {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.stats__table {
  --accent: var(--page-accent);
}

.stats__disclaimer {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-radius: 6px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: 0.75rem;
  line-height: 1.4;
}

.stats__disclaimer svg {
  flex-shrink: 0;
  margin-top: 1px;
}

.stats__disclaimer p {
  margin: 0;
}

@media (max-width: 767px) {
  .stats__header {
    padding: var(--space-lg) 0 var(--space-md);
  }
}
</style>
