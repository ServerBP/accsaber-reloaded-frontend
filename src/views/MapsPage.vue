<script setup lang="ts">
import BaseSelect from '@/components/common/BaseSelect.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import FilterButton from '@/components/common/FilterButton.vue'
import FilterPopover from '@/components/common/FilterPopover.vue'
import PaginationControls from '@/components/common/PaginationControls.vue'
import SearchBox from '@/components/common/SearchBox.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import MapCard from '@/components/domain/MapCard.vue'
import { usePageMeta } from '@/composables/usePageMeta'
import { usePageableRoute } from '@/composables/usePageableRoute'
import { useAuthStore } from '@/stores/auth'
import { useCategoryStore } from '@/stores/categories'
import type { PublicBatchResponse } from '@/types/api/batches'
import type { PublicMapDifficultyResponse } from '@/types/api/maps'
import type { MapDisplay } from '@/types/display'
import type { Page } from '@/types/pagination'
import { toMapDisplay } from '@/utils/mappers'
import { buildMapRoute } from '@/utils/mapRoute'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import BatchListView from './maps/BatchListView.vue'
import MapFilterSidebar from './maps/MapFilterSidebar.vue'
import MapListView from './maps/MapListView.vue'
import PlaylistDropdown from './maps/PlaylistDropdown.vue'
import ViewToggle from './maps/ViewToggle.vue'

const route = useRoute()
const router = useRouter()
const categoryStore = useCategoryStore()
const authStore = useAuthStore()

usePageMeta({
  title: 'Maps | AccSaber',
  description: 'Browse all ranked maps on AccSaber across categories and difficulties.',
})

type ViewMode = 'grid' | 'list' | 'batch'

const MAPS_VIEW_KEY = 'accsaber:maps-view'

const viewMode = computed<ViewMode>({
  get() {
    const v = route.query.view as string
    if (v === 'grid' || v === 'list' || v === 'batch') return v
    const stored = localStorage.getItem(MAPS_VIEW_KEY) as ViewMode | null
    if (stored === 'list' || stored === 'batch') return stored
    return 'grid'
  },
  set(val) {
    localStorage.setItem(MAPS_VIEW_KEY, val)
    const query = { ...route.query }
    query.view = val
    delete query.page
    router.replace({ query })
  },
})

const filtersOpen = ref(false)
const searchQuery = ref('')

const unplayedOnly = computed<boolean>({
  get() { return route.query.unplayed === 'true' },
  set(val) {
    const query = { ...route.query }
    if (val) {
      query.unplayed = 'true'
    } else {
      delete query.unplayed
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
  get() {
    const min = Number(route.query.complexityMin) || 0
    const max = Number(route.query.complexityMax) || 20
    return [min, max]
  },
  set(val) {
    const query = { ...route.query }
    if (val[0] <= 0) {
      delete query.complexityMin
    } else {
      query.complexityMin = String(val[0])
    }
    if (val[1] >= 20) {
      delete query.complexityMax
    } else {
      query.complexityMax = String(val[1])
    }
    delete query.page
    router.replace({ query })
  },
})

const hasActiveFilters = computed(() =>
  selectedCategories.value.length > 0 || complexityRange.value[0] > 0 || complexityRange.value[1] < 20 || unplayedOnly.value
)

const sortOptions = [
  { value: 'releaseDate', label: 'Release Date' },
  { value: 'complexity', label: 'Complexity' },
  { value: 'name', label: 'Name' },
]

const batchSortOptions = [
  { value: 'releasedAt', label: 'Release Date' },
  { value: 'difficultyCount', label: 'Difficulty Count' },
]

const batchSortKey = computed<string>({
  get() {
    return (route.query.batchSort as string) || 'releasedAt'
  },
  set(val) {
    const query = { ...route.query }
    if (val === 'releasedAt') {
      delete query.batchSort
    } else {
      query.batchSort = val
    }
    delete query.page
    router.replace({ query })
  },
})

const { currentPage, sortState, paginationParams, setPage, setSort } = usePageableRoute({
  defaultSort: 'releaseDate',
  defaultOrder: 'desc',
  defaultSize: 20,
  sortFieldMap: {
    releaseDate: 'rankedAt',
    name: 'songName',
  },
  secondarySort: null,
})

const difficulties = ref<PublicMapDifficultyResponse[]>([])
const totalPages = ref(0)
const totalElements = ref(0)
const loading = ref(true)

const batches = ref<PublicBatchResponse[]>([])
const batchTotalPages = ref(0)
const batchLoading = ref(true)

const mapDisplays = computed<MapDisplay[]>(() =>
  difficulties.value.map((d) => toMapDisplay(d, (id) => categoryStore.getCategoryCode(id)))
)

const listRows = computed(() =>
  mapDisplays.value.map((m) => ({
    id: m.id,
    difficultyId: m.difficultyId,
    cover: m.coverUrl,
    coverFallback: m.coverFallbackUrl,
    songName: m.songName,
    difficultyLabel: m.difficultyLabel,
    difficulty: m.difficulty,
    artistName: m.artistName,
    mapperName: m.mapperName,
    category: (categoryStore.getCategoryInfo(m.categoryCode)?.name ?? m.categoryCode).replace(/ Acc$/, ''),
    categoryCode: m.categoryCode,
    complexity: m.complexity,
    totalScores: m.totalScores ?? 0,
    rankedAt: m.rankedAt ?? '',
    beatsaverCode: m.beatsaverCode,
    characteristic: m.characteristic,
  }))
)

const listSortFieldMap: Record<string, string> = {
  songName: 'name',
  rankedAt: 'releaseDate',
}

function handleListSort(key: string) {
  setSort(listSortFieldMap[key] ?? key)
}

const listSortState = computed(() => {
  const reverseMap: Record<string, string> = {
    name: 'songName',
    releaseDate: 'rankedAt',
  }
  return {
    key: reverseMap[sortState.value.key] ?? sortState.value.key,
    direction: sortState.value.direction,
  }
})

const isBatchView = computed(() => viewMode.value === 'batch')

async function fetchDifficulties() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { ...paginationParams.value, status: 'RANKED' }
    if (selectedCategories.value.length === 1) {
      params.categoryId = selectedCategories.value[0]
    }
    if (complexityRange.value[0] > 0) {
      params.complexityMin = complexityRange.value[0]
    }
    if (complexityRange.value[1] < 20) {
      params.complexityMax = complexityRange.value[1]
    }
    if (searchQuery.value.trim()) {
      params.search = searchQuery.value.trim()
    }
    let res: Page<PublicMapDifficultyResponse>
    if (unplayedOnly.value && authStore.userId) {
      const { getUserMissingMaps } = await import('@/api/users')
      res = await getUserMissingMaps(authStore.userId, params as never)
    } else {
      const { getDifficulties } = await import('@/api/maps')
      res = await getDifficulties(params as never)
    }
    difficulties.value = res.content
    totalPages.value = res.totalPages
    totalElements.value = res.totalElements
  } catch {
    difficulties.value = []
    totalPages.value = 0
    totalElements.value = 0
  }
  loading.value = false
}

async function fetchBatches() {
  batchLoading.value = true
  try {
    const { getBatches } = await import('@/api/batches')
    const sortParam = batchSortKey.value === 'difficultyCount'
      ? 'difficultyCount,desc'
      : 'releasedAt,desc'
    const res = await getBatches({
      page: currentPage.value - 1,
      size: 10,
      sort: sortParam,
    })
    batches.value = res.content
    batchTotalPages.value = res.totalPages
  } catch {
    batches.value = []
    batchTotalPages.value = 0
  }
  batchLoading.value = false
}

function mapRouteTo(m: Pick<MapDisplay, 'id' | 'difficultyId' | 'difficulty' | 'characteristic' | 'beatsaverCode'>): RouteLocationRaw {
  return buildMapRoute({
    beatsaverCode: m.beatsaverCode ?? null,
    mapId: m.id,
    difficulty: m.difficulty,
    difficultyId: m.difficultyId,
    characteristic: m.characteristic ?? null,
  })
}

function listRowTo(row: Record<string, unknown>): RouteLocationRaw {
  return mapRouteTo({
    id: row.id as string,
    difficultyId: row.difficultyId as string,
    difficulty: row.difficulty as string,
    characteristic: row.characteristic as string | undefined,
    beatsaverCode: row.beatsaverCode as string | undefined,
  })
}

watch(searchQuery, () => {
  const query = { ...route.query }
  delete query.page
  router.replace({ query })
})

watch(
  [paginationParams, selectedCategories, complexityRange, searchQuery, unplayedOnly],
  () => { if (!isBatchView.value) fetchDifficulties() },
  { immediate: true, deep: true },
)

watch(
  [() => viewMode.value, currentPage, batchSortKey],
  () => {
    if (isBatchView.value) fetchBatches()
  },
  { immediate: true },
)
</script>

<template>
  <div class="maps-page">
    <div class="maps-page__header">
      <div>
        <h1 class="maps-page__title">Maps</h1>
        <p v-if="!isBatchView && !loading" class="maps-page__subtitle">
          {{ totalElements.toLocaleString() }} ranked difficulties
        </p>
      </div>
    </div>

    <div class="maps-page__controls">
      <div class="maps-page__controls-left">
        <PlaylistDropdown />
        <BaseSelect v-if="viewMode === 'grid'" :options="sortOptions" :model-value="sortState.key"
          @update:model-value="setSort($event)" />
        <BaseSelect v-if="isBatchView" :options="batchSortOptions" :model-value="batchSortKey"
          @update:model-value="batchSortKey = $event" />
        <SearchBox v-if="!isBatchView" v-model="searchQuery" placeholder="Search by song, artist, or mapper..." />
      </div>
      <div class="maps-page__controls-right">
        <ViewToggle v-model="viewMode" />

        <FilterPopover v-if="!isBatchView" :open="filtersOpen" @update:open="filtersOpen = $event">
          <template #trigger>
            <FilterButton :active="filtersOpen || hasActiveFilters" :has-indicator="hasActiveFilters" />
          </template>
          <MapFilterSidebar :selected-categories="selectedCategories" :complexity-range="complexityRange"
            :unplayed-only="unplayedOnly" :show-unplayed="authStore.isLoggedIn"
            @update:selected-categories="selectedCategories = $event"
            @update:complexity-range="complexityRange = $event" @update:unplayed-only="unplayedOnly = $event" />
        </FilterPopover>
      </div>
    </div>

    <div class="maps-page__content">
      <template v-if="viewMode === 'grid'">
        <div v-if="loading" class="maps-page__grid">
          <SkeletonLoader v-for="i in 12" :key="i" variant="card" />
        </div>
        <EmptyState v-else-if="mapDisplays.length === 0" message="No maps found matching your filters." />
        <div v-else class="maps-page__grid">
          <MapCard v-for="m in mapDisplays" :key="m.difficultyId" :map="m" :to="mapRouteTo(m)" />
        </div>
      </template>

      <MapListView v-else-if="viewMode === 'list'" :rows="listRows" :loading="loading" :sort-state="listSortState"
        :row-to="listRowTo" @sort="handleListSort" />

      <BatchListView v-else-if="viewMode === 'batch'" :batches="batches" :loading="batchLoading"
        :map-route-to="mapRouteTo" />

      <PaginationControls v-if="!isBatchView && totalPages > 1" :page="currentPage" :total-pages="totalPages"
        @update:page="setPage($event)" />
      <PaginationControls v-if="isBatchView && batchTotalPages > 1" :page="currentPage" :total-pages="batchTotalPages"
        @update:page="setPage($event)" />
    </div>
  </div>
</template>

<style scoped>
.maps-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.maps-page__header {
  display: flex;
  align-items: baseline;
  gap: var(--space-md);
}

.maps-page__title {
  font-size: var(--text-page-title);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.maps-page__subtitle {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  margin: var(--space-xs) 0 0;
}

.maps-page__controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
}

.maps-page__controls-left {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex-wrap: wrap;
  min-width: 0;
}

.maps-page__controls-left :deep(.search-box) {
  min-width: 320px;
  flex: 1 1 320px;
}

.maps-page__controls-right {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.maps-page__content {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.maps-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-md);
}

@media (max-width: 767px) {
  .maps-page__grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  }

  .maps-page__controls {
    flex-wrap: wrap;
  }

  .maps-page__controls-left {
    width: 100%;
  }

  .maps-page__controls-left :deep(.search-box) {
    min-width: 0;
    flex: 1 1 100%;
    width: 100%;
  }
}
</style>
