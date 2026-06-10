<script setup lang="ts">
import BaseTabs from '@/components/common/BaseTabs.vue'
import DataTable from '@/components/common/DataTable.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import FilterButton from '@/components/common/FilterButton.vue'
import FilterPopover from '@/components/common/FilterPopover.vue'
import GlowImage from '@/components/common/GlowImage.vue'
import PageHeaderBleed from '@/components/common/PageHeaderBleed.vue'
import PaginationControls from '@/components/common/PaginationControls.vue'
import SearchBox from '@/components/common/SearchBox.vue'
import ComplexityBadge from '@/components/domain/ComplexityBadge.vue'
import QueuedPlaylistsButton from '@/components/domain/QueuedPlaylistsButton.vue'
import { usePageMeta } from '@/composables/usePageMeta'
import { usePageableRoute } from '@/composables/usePageableRoute'
import { useCategoryStore } from '@/stores/categories'
import { useRankingQueueStore } from '@/stores/rankingQueue'
import MapFilterSidebar from '@/views/maps/MapFilterSidebar.vue'

import type { MapDifficultyResponse } from '@/types/api/maps'
import type { Tab, TableColumn } from '@/types/display'
import type { MapDifficultyStatus } from '@/types/enums'
import { MAP_STATUS_ACCENT } from '@/utils/constants'
import { formatRelativeDate, truncate } from '@/utils/formatters'
import { formatDifficulty } from '@/utils/mappers'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const categoryStore = useCategoryStore()
const queueCache = useRankingQueueStore()


usePageMeta({
  title: 'Ranking Queue | AccSaber',
  description: 'View and manage maps in the AccSaber ranking queue.',
})

const statusTabs: Tab[] = [
  { key: 'QUEUE', label: 'Queue' },
  { key: 'RANKED', label: 'Reweighting' },
]

const pageTitle = computed(() =>
  activeStatus.value === 'RANKED' ? 'Reweighting Queue' : 'Ranking Queue'
)

const accent = computed(() => MAP_STATUS_ACCENT[activeStatus.value] ?? 'var(--accent-overall)')

const subtitleText = computed(() => {
  if (!totalElements.value) return ''
  if (activeStatus.value === 'RANKED') return `${totalElements.value} ranked maps`
  return `${totalElements.value} maps in queue`
})

const activeStatus = computed<MapDifficultyStatus>({
  get() {
    return route.query.status === 'RANKED' ? 'RANKED' : 'QUEUE'
  },
  set(val) {
    const query = { ...route.query }
    if (val === 'RANKED') {
      query.status = val
    } else {
      delete query.status
    }
    delete query.page
    router.replace({ query })
  },
})

const selectedCategories = computed<string[]>({
  get() {
    const c = route.query.category
    if (!c) return []
    return Array.isArray(c) ? c as string[] : [c as string]
  },
  set(val) {
    const query = { ...route.query }
    if (val.length === 0) {
      delete query.category
    } else if (val.length === 1) {
      query.category = val[0]
    } else {
      query.category = val
    }
    delete query.page
    router.replace({ query })
  },
})

const complexityRange = computed<[number, number]>({
  get(): [number, number] {
    const min = Number(route.query.complexityMin) || 0
    const max = Number(route.query.complexityMax) || 20
    return [min, max]
  },
  set(val: [number, number]) {
    const query = { ...route.query }
    if (val[0] <= 0) { delete query.complexityMin } else { query.complexityMin = String(val[0]) }
    if (val[1] >= 20) { delete query.complexityMax } else { query.complexityMax = String(val[1]) }
    delete query.page
    router.replace({ query })
  },
})

const filtersOpen = ref(false)
const searchQuery = ref('')

const hasActiveFilters = computed(() =>
  selectedCategories.value.length > 0 || complexityRange.value[0] > 0 || complexityRange.value[1] < 20
)

const { currentPage, sortState, paginationParams, setPage, setSort } = usePageableRoute({
  defaultSort: 'rating',
  defaultOrder: 'desc',
  defaultSize: 20,
  sortFieldMap: {
    submitted: 'createdAt',
  },
  secondarySort: null,
})

const baseColumns: TableColumn[] = [
  { key: 'cover', label: '', width: '48px' },
  { key: 'song', label: 'Song', align: 'left' },
  { key: 'mapper', label: 'Mapper', align: 'left', width: '120px' },
  { key: 'category', label: 'Category', align: 'center', width: '110px' },
  { key: 'status', label: 'Status', align: 'center', width: '96px' },
  { key: 'complexity', label: 'Complexity', sortable: true, align: 'center', width: '100px' },
  { key: 'criteria', label: 'Criteria', align: 'center', width: '90px' },
  { key: 'rating', label: 'Rating', sortable: true, align: 'center', mono: true, width: '70px' },
  { key: 'submitted', label: 'Submitted', sortable: true, align: 'right', width: '100px' },
  { key: 'submittedBy', label: 'By', align: 'left', width: '120px' },
]

const columns = computed(() =>
  activeStatus.value === 'RANKED'
    ? baseColumns.filter((c) => c.key !== 'criteria' && c.key !== 'status')
    : baseColumns
)

const difficulties = ref<MapDifficultyResponse[]>([])
const totalPages = ref(0)
const totalElements = ref(0)
const loading = ref(true)

const rows = computed(() =>
  difficulties.value.map((d) => {
    const catCode = categoryStore.getCategoryCode(d.categoryId)
    const catInfo = catCode ? categoryStore.getCategoryInfo(catCode) : undefined
    return {
      id: d.id,
      mapId: d.mapId,
      coverUrl: d.cdnCoverUrl ?? d.coverUrl,
      coverFallbackUrl: d.cdnCoverUrl && d.coverUrl && d.cdnCoverUrl !== d.coverUrl ? d.coverUrl : null,
      songName: truncate(d.songName, 25),
      songSubName: d.songSubName,
      songAuthor: truncate(d.songAuthor, 25),
      mapper: d.mapAuthor,
      categoryName: catInfo?.name ?? '',
      categoryCode: catCode ?? 'overall',
      categoryAccent: categoryStore.getAccent(catCode ?? 'overall'),
      status: d.status,
      complexity: d.complexity,
      criteriaStatus: d.criteriaStatus,
      autoCriteriaStatus: d.autoCriteriaStatus,
      criteriaUpvotes: d.criteriaUpvotes,
      criteriaDownvotes: d.criteriaDownvotes,
      headCriteriaVote: d.headCriteriaVote,
      rating: activeStatus.value === 'RANKED'
        ? d.reweightUpvotes - d.reweightDownvotes
        : d.rankUpvotes - d.rankDownvotes,
      createdAt: d.createdAt,
      createdByUsername: d.createdByUsername,
      createdByAvatarUrl: d.createdByAvatarUrl,
      difficulty: d.difficulty,
      characteristic: d.characteristic,
    }
  })
)

function buildFetchParams(): Record<string, unknown> {
  const params: Record<string, unknown> = {
    ...paginationParams.value,
    status: activeStatus.value === 'RANKED' ? 'RANKED' : 'QUEUE,QUALIFIED',
  }
  if (selectedCategories.value.length === 1) {
    params.categoryId = selectedCategories.value[0]
  }
  if (complexityRange.value[0] > 0) params.complexityMin = complexityRange.value[0]
  if (complexityRange.value[1] < 20) params.complexityMax = complexityRange.value[1]
  if (searchQuery.value.trim()) params.search = searchQuery.value.trim()
  return params
}

async function fetchDifficulties() {
  const params = buildFetchParams()
  const cached = queueCache.getCached(params)
  if (cached) {
    difficulties.value = cached.content
    totalPages.value = cached.totalPages
    totalElements.value = cached.totalElements
    loading.value = false
    try {
      const { getRankingDifficulties } = await import('@/api/ranking/maps')
      const res = await getRankingDifficulties(params as never)
      difficulties.value = res.content
      totalPages.value = res.totalPages
      totalElements.value = res.totalElements
      queueCache.setCache(params, res.content, res.totalPages, res.totalElements)
    } catch { }
    return
  }
  loading.value = true
  try {
    const { getRankingDifficulties } = await import('@/api/ranking/maps')
    const res = await getRankingDifficulties(params as never)
    difficulties.value = res.content
    totalPages.value = res.totalPages
    totalElements.value = res.totalElements
    queueCache.setCache(params, res.content, res.totalPages, res.totalElements)
  } catch {
    difficulties.value = []
    totalPages.value = 0
    totalElements.value = 0
  }
  loading.value = false
}

watch(
  [() => activeStatus.value, selectedCategories, complexityRange, paginationParams, () => searchQuery.value],
  fetchDifficulties,
  { immediate: true },
)

watch(
  () => route.fullPath,
  (path) => queueCache.rememberReturnUrl(path),
  { immediate: true },
)

function navigateToDetail(row: Record<string, unknown>) {
  router.push({
    name: 'ranking-map-detail',
    params: { difficultyId: row.id as string },
  })
}


function ratingClass(rating: number): string {
  if (rating > 0) return 'ranking-dashboard__rating--positive'
  if (rating < 0) return 'ranking-dashboard__rating--negative'
  return 'ranking-dashboard__rating--neutral'
}


function headCriteriaClass(vote: string): string {
  if (vote === 'UPVOTE') return 'criteria-text--passed'
  if (vote === 'DOWNVOTE') return 'criteria-text--failed'
  return 'criteria-text--pending'
}

function criteriaVerdict(row: Record<string, unknown>): {
  verdict: 'passed' | 'failed' | 'pending' | 'unavailable'
  source: 'staff' | 'auto' | 'none'
} {
  const status = row.criteriaStatus as string | null
  const up = (row.criteriaUpvotes as number) ?? 0
  const down = (row.criteriaDownvotes as number) ?? 0
  if (status === 'PASSED' || up > down) return { verdict: 'passed', source: 'staff' }
  if (status === 'FAILED' || down > up) return { verdict: 'failed', source: 'staff' }
  const auto = row.autoCriteriaStatus as string | null
  if (auto === 'PASSED') return { verdict: 'passed', source: 'auto' }
  if (auto === 'FAILED') return { verdict: 'failed', source: 'auto' }
  if (auto === 'UNAVAILABLE') return { verdict: 'unavailable', source: 'auto' }
  return { verdict: 'pending', source: 'none' }
}

function criteriaLabel(row: Record<string, unknown>): string {
  const { verdict, source } = criteriaVerdict(row)
  const base = verdict === 'passed' ? 'PASS' : verdict === 'failed' ? 'FAIL' : verdict === 'unavailable' ? 'N/A' : 'PENDING'
  return source === 'auto' ? `AUTO ${base}` : base
}

function criteriaClassName(row: Record<string, unknown>): string {
  const { verdict, source } = criteriaVerdict(row)
  const classes: string[] = []
  if (verdict === 'passed') classes.push('criteria-text--passed')
  else if (verdict === 'failed') classes.push('criteria-text--failed')
  else if (verdict === 'unavailable') classes.push('criteria-text--unavailable')
  else classes.push('criteria-text--pending')
  if (source === 'auto') classes.push('criteria-text--auto')
  return classes.join(' ')
}
</script>

<template>
  <div class="ranking-dashboard" :style="{ '--page-accent': accent, '--accent': accent }">
    <PageHeaderBleed :title="pageTitle" :subtitle="subtitleText" />

    <div class="ranking-dashboard__controls">
      <BaseTabs :tabs="statusTabs" :model-value="activeStatus" @update:model-value="activeStatus = $event as MapDifficultyStatus" />
      <div class="ranking-dashboard__filters">
        <QueuedPlaylistsButton />
        <SearchBox v-model="searchQuery" placeholder="Search by song, artist, or mapper..." style="flex: 1; min-width: 240px;" />
        <FilterPopover :open="filtersOpen" @update:open="filtersOpen = $event">
          <template #trigger>
            <FilterButton :active="filtersOpen || hasActiveFilters" :has-indicator="hasActiveFilters" />
          </template>
          <MapFilterSidebar
            :selected-categories="selectedCategories"
            :complexity-range="complexityRange"
            @update:selected-categories="selectedCategories = $event"
            @update:complexity-range="complexityRange = $event"
          />
        </FilterPopover>
      </div>
    </div>

    <div class="ranking-dashboard__table">
    <DataTable
      :columns="columns"
      :rows="rows"
      :sort-state="sortState"
      :loading="loading"
      :loading-rows="8"
      row-clickable
      :row-key="(row: Record<string, unknown>) => row.id as string"
      empty-message="No maps found"
      @sort="setSort"
      @row-click="navigateToDetail"
    >
      <template #cell-cover="{ row }">
        <GlowImage :src="row.coverUrl as string" alt="" :size="40"
          :fallback-src="(row.coverFallbackUrl as string | null | undefined) ?? null" />
      </template>

      <template #cell-song="{ row }">
        <div class="ranking-dashboard__song-cell">
          <span class="ranking-dashboard__song-name">{{ row.songName }}</span>
          <span class="ranking-dashboard__song-meta">
            {{ row.songAuthor }}
            <span class="diff-badge" :class="'diff-badge--' + (row.difficulty as string).toLowerCase()">
              {{ formatDifficulty(row.difficulty as string) }}
            </span>
          </span>
        </div>
      </template>

      <template #cell-category="{ row }">
        <span class="ranking-dashboard__category">
          <span class="ranking-dashboard__category-dot" :style="{ background: row.categoryAccent as string }" />
          {{ (row.categoryName as string).replace(/ Acc$/, '') }}
        </span>
      </template>

      <template #cell-status="{ row }">
        <span class="ranking-dashboard__status" :class="'ranking-dashboard__status--' + (row.status as string).toLowerCase()">
          {{ row.status === 'QUALIFIED' ? 'Qualified' : 'In Queue' }}
        </span>
      </template>

      <template #cell-complexity="{ row }">
        <ComplexityBadge v-if="row.complexity != null" :complexity="row.complexity as number" />
        <span v-else class="ranking-dashboard__rating--neutral">-</span>
      </template>

      <template #cell-criteria="{ row }">
        <span v-if="row.headCriteriaVote" class="ranking-dashboard__criteria criteria-text--head" :class="headCriteriaClass(row.headCriteriaVote as string)">
          HEAD {{ row.headCriteriaVote === 'UPVOTE' ? 'PASS' : row.headCriteriaVote === 'DOWNVOTE' ? 'FAIL' : 'NEUTRAL' }}
        </span>
        <span v-else class="ranking-dashboard__criteria" :class="criteriaClassName(row)">{{ criteriaLabel(row) }}</span>
      </template>

      <template #cell-rating="{ row }">
        <span class="ranking-dashboard__rating" :class="ratingClass(row.rating as number)">
          {{ (row.rating as number) > 0 ? '+' : '' }}{{ row.rating }}
        </span>
      </template>

      <template #cell-submitted="{ row }">
        <span class="ranking-dashboard__date">{{ formatRelativeDate(row.createdAt as string) }}</span>
      </template>

      <template #cell-submittedBy="{ row }">
        <span v-if="row.createdByUsername" class="ranking-dashboard__submitted-by">
          <img
            v-if="row.createdByAvatarUrl"
            :src="row.createdByAvatarUrl as string"
            alt=""
            class="ranking-dashboard__submitted-avatar"
            loading="lazy"
            decoding="async"
          />
          {{ row.createdByUsername }}
        </span>
        <span v-else class="ranking-dashboard__submitted-by ranking-dashboard__submitted-by--unknown">-</span>
      </template>

      <template #mobile-card="{ row }">
        <div class="ranking-dashboard__mobile-card" @click="navigateToDetail(row)">
          <GlowImage :src="row.coverUrl as string" alt="" :size="48"
            :fallback-src="(row.coverFallbackUrl as string | null | undefined) ?? null" />
          <div class="ranking-dashboard__mobile-info">
            <span class="ranking-dashboard__song-name">{{ row.songName }}</span>
            <span class="ranking-dashboard__song-meta">{{ row.songAuthor }} - {{ row.mapper }}</span>
            <div class="ranking-dashboard__mobile-meta">
              <span v-if="row.status !== 'RANKED'" class="ranking-dashboard__status"
                :class="'ranking-dashboard__status--' + (row.status as string).toLowerCase()">
                {{ row.status === 'QUALIFIED' ? 'Qualified' : 'In Queue' }}
              </span>
              <ComplexityBadge v-if="row.complexity != null" :complexity="row.complexity as number" />
              <span v-if="row.headCriteriaVote" class="ranking-dashboard__criteria criteria-text--head" :class="headCriteriaClass(row.headCriteriaVote as string)">
                HEAD {{ row.headCriteriaVote === 'UPVOTE' ? 'PASS' : row.headCriteriaVote === 'DOWNVOTE' ? 'FAIL' : 'NEUTRAL' }}
              </span>
              <span v-else class="ranking-dashboard__criteria" :class="criteriaClassName(row)">{{ criteriaLabel(row) }}</span>
              <span class="ranking-dashboard__rating" :class="ratingClass(row.rating as number)">
                {{ (row.rating as number) > 0 ? '+' : '' }}{{ row.rating }}
              </span>
            </div>
          </div>
        </div>
      </template>

      <template #empty>
        <EmptyState message="No maps in this queue" />
      </template>
    </DataTable>
    </div>

    <PaginationControls
      v-if="totalPages > 1"
      :page="currentPage"
      :total-pages="totalPages"
      @update:page="setPage"
    />
  </div>
</template>

<style scoped>
.ranking-dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.ranking-dashboard__controls {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-md);
}

.ranking-dashboard__filters {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.ranking-dashboard__song-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ranking-dashboard__song-name {
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ranking-dashboard__song-meta {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.ranking-dashboard__category {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.ranking-dashboard__category-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ranking-dashboard__criteria {
  font-size: var(--text-caption);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.ranking-dashboard__rating {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  font-weight: 600;
}

.ranking-dashboard__rating--positive { color: var(--success); }
.ranking-dashboard__rating--negative { color: var(--error); }
.ranking-dashboard__rating--neutral { color: var(--text-tertiary); }

.ranking-dashboard__status {
  font-size: var(--text-caption);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.ranking-dashboard__status--queue { color: var(--warning); }
.ranking-dashboard__status--qualified { color: var(--info); }

.ranking-dashboard__date {
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.ranking-dashboard__submitted-by {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.ranking-dashboard__submitted-by--unknown {
  color: var(--text-tertiary);
}

.ranking-dashboard__submitted-avatar {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  object-fit: cover;
}

.ranking-dashboard__mobile-card {
  display: flex;
  gap: var(--space-md);
  padding: var(--space-md);
  cursor: pointer;
}

.ranking-dashboard__mobile-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.ranking-dashboard__mobile-meta {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-top: var(--space-xs);
}

@media (max-width: 767px) {
  .ranking-dashboard__controls {
    flex-direction: column;
    align-items: stretch;
  }

  .ranking-dashboard__filters {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
