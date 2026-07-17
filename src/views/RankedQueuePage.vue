<script setup lang="ts">
import EmptyState from '@/components/common/EmptyState.vue'
import FilterButton from '@/components/common/FilterButton.vue'
import FilterPopover from '@/components/common/FilterPopover.vue'
import PageHeaderBleed from '@/components/common/PageHeaderBleed.vue'
import PaginationControls from '@/components/common/PaginationControls.vue'
import SearchBox from '@/components/common/SearchBox.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import QueuedPlaylistsButton from '@/components/domain/QueuedPlaylistsButton.vue'
import RankedQueueRow from '@/components/domain/RankedQueueRow.vue'
import { usePageMeta } from '@/composables/usePageMeta'
import { usePageableRoute } from '@/composables/usePageableRoute'
import { useLeaderboardCacheStore } from '@/stores/leaderboardCache'
import type { PublicMapDifficultyResponse } from '@/types/api/maps'
import type { Page } from '@/types/pagination'
import { MAP_STATUS_ACCENT } from '@/utils/constants'
import { buildMapRoute } from '@/utils/mapRoute'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MapFilterSidebar from './maps/MapFilterSidebar.vue'

const route = useRoute()
const router = useRouter()
const queueCache = useLeaderboardCacheStore()

usePageMeta({
  title: 'Ranking Queue | AccSaber',
  description: 'Maps awaiting ranking review on AccSaber. See community votes and criteria status.',
})

const accent = MAP_STATUS_ACCENT.QUEUE ?? 'var(--accent-overall)'

const { currentPage, paginationParams, setPage } = usePageableRoute({
  defaultSort: 'dateAdded',
  defaultOrder: 'desc',
  defaultSize: 20,
  sortFieldMap: {
    dateAdded: 'createdAt',
  },
  secondarySort: null,
})

const selectedCategories = computed<string[]>({
  get() {
    const c = route.query.category
    if (!c) return []
    return Array.isArray(c) ? (c as string[]) : [c as string]
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

const filtersOpen = ref(false)
const searchQuery = ref('')

const hasActiveFilters = computed(() => selectedCategories.value.length > 0)

const difficulties = ref<PublicMapDifficultyResponse[]>([])
const totalPages = ref(0)
const totalElements = ref(0)
const loading = ref(true)

const subtitle = computed(() => {
  if (loading.value) return ''
  if (totalElements.value === 0) return 'No maps awaiting review'
  const noun = totalElements.value === 1 ? 'map' : 'maps'
  return `${totalElements.value} ${noun} in the ranking queue`
})

function buildCacheKey(): Record<string, unknown> {
  return {
    _type: 'ranked-queue',
    ...paginationParams.value,
    status: 'QUEUE',
    categoryId: selectedCategories.value.length === 1 ? selectedCategories.value[0] : undefined,
    search: searchQuery.value.trim() || undefined,
  }
}

function applyPage(res: Page<PublicMapDifficultyResponse>) {
  difficulties.value = res.content
  totalPages.value = res.totalPages
  totalElements.value = res.totalElements
}

async function fetchFromApi(cacheKey: Record<string, unknown>) {
  const params: Record<string, unknown> = {
    ...paginationParams.value,
    status: 'QUEUE',
  }
  if (selectedCategories.value.length === 1) {
    params.categoryId = selectedCategories.value[0]
  }
  if (searchQuery.value.trim()) {
    params.search = searchQuery.value.trim()
  }
  const { getDifficulties } = await import('@/api/maps')
  const res = await getDifficulties(params as never)
  applyPage(res)
  queueCache.setCache(cacheKey, res)
}

async function fetchDifficulties() {
  const cacheKey = buildCacheKey()
  const cached = queueCache.getCached<Page<PublicMapDifficultyResponse>>(cacheKey)

  if (cached) {
    applyPage(cached)
    loading.value = false
    try {
      await fetchFromApi(cacheKey)
    } catch { }
    return
  }

  loading.value = true
  try {
    await fetchFromApi(cacheKey)
  } catch {
    difficulties.value = []
    totalPages.value = 0
    totalElements.value = 0
  }
  loading.value = false
}

watch(searchQuery, () => {
  const query = { ...route.query }
  delete query.page
  router.replace({ query })
})

watch(
  [selectedCategories, paginationParams, searchQuery],
  fetchDifficulties,
  { immediate: true, deep: true },
)

function navigateToMap(entry: PublicMapDifficultyResponse) {
  router.push(buildMapRoute({
    beatsaverCode: entry.beatsaverCode,
    mapId: entry.mapId,
    difficulty: entry.difficulty,
    difficultyId: entry.id,
    characteristic: entry.characteristic,
  }))
}

const emptyMessage = 'No maps currently in the ranking queue. Check back soon.'
</script>

<template>
  <div class="queue-page" :style="{ '--page-accent': accent, '--accent': accent }">
    <PageHeaderBleed title="Ranking Queue" :subtitle="subtitle" />

    <aside class="queue-page__notice" role="note">
      <svg class="queue-page__notice-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p class="queue-page__notice-text">
        Ratings and vote counts are hidden for now. AccSaber currently relies on the original
        ranking team and pipeline to rank maps, so the numbers shown here would not reflect
        actual ranking activity. This page is informational only.
      </p>
    </aside>

    <div class="queue-page__controls">
      <div class="queue-page__filters">
        <QueuedPlaylistsButton />
        <SearchBox v-model="searchQuery" placeholder="Search by song, artist, or mapper..."
          class="queue-page__search" />
        <FilterPopover :open="filtersOpen" @update:open="filtersOpen = $event">
          <template #trigger>
            <FilterButton :active="filtersOpen || hasActiveFilters" :has-indicator="hasActiveFilters" />
          </template>
          <MapFilterSidebar :selected-categories="selectedCategories" :complexity-range="[0, 20]"
            :show-complexity="false" @update:selected-categories="selectedCategories = $event" />
        </FilterPopover>
      </div>
    </div>

    <div class="queue-page__list">
      <template v-if="loading">
        <SkeletonLoader v-for="i in 8" :key="'skel-' + i" variant="card" height="88px" />
      </template>
      <template v-else-if="difficulties.length === 0">
        <EmptyState :message="emptyMessage" />
      </template>
      <template v-else>
        <RankedQueueRow v-for="entry in difficulties" :key="entry.id" :entry="entry" @click="navigateToMap(entry)" />
      </template>
    </div>

    <PaginationControls v-if="totalPages > 1" :page="currentPage" :total-pages="totalPages"
      @update:page="setPage($event)" />
  </div>
</template>

<style scoped>
.queue-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  max-width: 1030px;
  margin: 0 auto;
  width: 100%;
}

.queue-page__notice {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-md);
  background: color-mix(in srgb, var(--warning) 8%, var(--bg-surface));
  border: 1px solid color-mix(in srgb, var(--warning) 30%, transparent);
  border-radius: var(--radius-card);
}

.queue-page__notice-icon {
  flex-shrink: 0;
  color: var(--warning);
  margin-top: 1px;
}

.queue-page__notice-text {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--text-secondary);
  line-height: 1.5;
}

.queue-page__controls {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-md);
}

.queue-page__filters {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
  flex: 1;
}

.queue-page__search {
  flex: 1;
  min-width: 240px;
}

.queue-page__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

@media (max-width: 767px) {
  .queue-page__controls {
    flex-direction: column;
    align-items: stretch;
  }

  .queue-page__filters {
    flex-direction: row;
    align-items: stretch;
  }

  .queue-page__search {
    flex: 1;
    min-width: 0;
  }
}
</style>
