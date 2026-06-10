<script setup lang="ts">
import DataTable from '@/components/common/DataTable.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import FilterButton from '@/components/common/FilterButton.vue'
import FilterPopover from '@/components/common/FilterPopover.vue'
import GlowImage from '@/components/common/GlowImage.vue'
import PageHeaderBleed from '@/components/common/PageHeaderBleed.vue'
import PaginationControls from '@/components/common/PaginationControls.vue'
import SearchBox from '@/components/common/SearchBox.vue'
import ComplexityBadge from '@/components/domain/ComplexityBadge.vue'
import { usePageMeta } from '@/composables/usePageMeta'
import { usePageableRoute } from '@/composables/usePageableRoute'
import { useCategoryStore } from '@/stores/categories'
import type { MapDifficultyResponse } from '@/types/api/maps'
import type { TableColumn } from '@/types/display'
import { formatRelativeDate, truncate } from '@/utils/formatters'
import { formatDifficulty } from '@/utils/mappers'
import MapFilterSidebar from '@/views/maps/MapFilterSidebar.vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const categoryStore = useCategoryStore()

usePageMeta({
  title: 'Deactivated Maps | AccSaber Ranking',
  description: 'Read-only view of deactivated map difficulties.',
})

const accent = 'var(--text-tertiary)'

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
  selectedCategories.value.length > 0 || complexityRange.value[0] > 0 || complexityRange.value[1] < 20,
)

const { currentPage, sortState, paginationParams, setPage, setSort } = usePageableRoute({
  defaultSort: 'created',
  defaultOrder: 'desc',
  defaultSize: 20,
  sortFieldMap: {
    created: 'createdAt',
  },
  secondarySort: null,
})

const columns: TableColumn[] = [
  { key: 'cover', label: '', width: '48px' },
  { key: 'song', label: 'Song', align: 'left' },
  { key: 'mapper', label: 'Mapper', align: 'left', width: '140px' },
  { key: 'category', label: 'Category', align: 'center', width: '120px' },
  { key: 'complexity', label: 'Complexity', align: 'center', width: '100px' },
  { key: 'created', label: 'Created', sortable: true, align: 'right', width: '120px' },
  { key: 'lastUpdatedBy', label: 'Last Edited By', align: 'left', width: '140px' },
]

const difficulties = ref<MapDifficultyResponse[]>([])
const totalPages = ref(0)
const totalElements = ref(0)
const loading = ref(true)

const subtitleText = computed(() => {
  if (!totalElements.value) return ''
  const noun = totalElements.value === 1 ? 'difficulty' : 'difficulties'
  return `${totalElements.value} deactivated ${noun}`
})

const rows = computed(() =>
  difficulties.value.map((d) => {
    const catCode = categoryStore.getCategoryCode(d.categoryId)
    const catInfo = catCode ? categoryStore.getCategoryInfo(catCode) : undefined
    return {
      id: d.id,
      coverUrl: d.cdnCoverUrl ?? d.coverUrl,
      coverFallbackUrl: d.cdnCoverUrl && d.coverUrl && d.cdnCoverUrl !== d.coverUrl ? d.coverUrl : null,
      songName: truncate(d.songName, 30),
      songAuthor: truncate(d.songAuthor, 25),
      mapper: d.mapAuthor,
      categoryName: catInfo?.name ?? '',
      categoryAccent: categoryStore.getAccent(catCode ?? 'overall'),
      complexity: d.complexity,
      difficulty: d.difficulty,
      createdAt: d.createdAt,
      lastUpdatedByUsername: d.lastUpdatedByUsername,
    }
  }),
)

async function fetchDifficulties() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { ...paginationParams.value }
    if (selectedCategories.value.length === 1) {
      params.categoryId = selectedCategories.value[0]
    }
    if (complexityRange.value[0] > 0) params.complexityMin = complexityRange.value[0]
    if (complexityRange.value[1] < 20) params.complexityMax = complexityRange.value[1]
    if (searchQuery.value.trim()) params.search = searchQuery.value.trim()

    const { getDeactivatedDifficulties } = await import('@/api/ranking/maps')
    const res = await getDeactivatedDifficulties(params as never)
    const list = Array.isArray(res) ? res : (res?.content ?? [])
    difficulties.value = list
    totalPages.value = Array.isArray(res) ? 1 : (res?.totalPages ?? 0)
    totalElements.value = Array.isArray(res) ? list.length : (res?.totalElements ?? list.length)
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
  [selectedCategories, complexityRange, paginationParams, searchQuery],
  fetchDifficulties,
  { immediate: true, deep: true },
)
</script>

<template>
  <div class="deactivated-page" :style="{ '--page-accent': accent, '--accent': accent }">
    <PageHeaderBleed title="Deactivated Maps" :subtitle="subtitleText" />

    <div class="deactivated-page__controls">
      <div class="deactivated-page__filters">
        <SearchBox
          v-model="searchQuery"
          placeholder="Search by song, artist, or mapper..."
          style="flex: 1; min-width: 240px;"
        />
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

    <div class="deactivated-page__table">
      <DataTable
        :columns="columns"
        :rows="rows"
        :sort-state="sortState"
        :loading="loading"
        :loading-rows="8"
        :row-key="(row: Record<string, unknown>) => row.id as string"
        empty-message="No deactivated maps"
        @sort="setSort"
      >
        <template #cell-cover="{ row }">
          <GlowImage :src="row.coverUrl as string" alt="" :size="40"
            :fallback-src="(row.coverFallbackUrl as string | null | undefined) ?? null" />
        </template>

        <template #cell-song="{ row }">
          <div class="deactivated-page__song-cell">
            <span class="deactivated-page__song-name">{{ row.songName }}</span>
            <span class="deactivated-page__song-meta">
              {{ row.songAuthor }}
              <span class="diff-badge" :class="'diff-badge--' + (row.difficulty as string).toLowerCase()">
                {{ formatDifficulty(row.difficulty as string) }}
              </span>
            </span>
          </div>
        </template>

        <template #cell-category="{ row }">
          <span class="deactivated-page__category">
            <span class="deactivated-page__category-dot" :style="{ background: row.categoryAccent as string }" />
            {{ (row.categoryName as string).replace(/ Acc$/, '') }}
          </span>
        </template>

        <template #cell-complexity="{ row }">
          <ComplexityBadge
            v-if="row.complexity != null"
            :complexity="row.complexity as number"
          />
          <span v-else class="deactivated-page__muted">-</span>
        </template>

        <template #cell-created="{ row }">
          <span class="deactivated-page__date">{{ formatRelativeDate(row.createdAt as string) }}</span>
        </template>

        <template #cell-lastUpdatedBy="{ row }">
          <span v-if="row.lastUpdatedByUsername" class="deactivated-page__by">
            {{ row.lastUpdatedByUsername }}
          </span>
          <span v-else class="deactivated-page__by deactivated-page__muted">-</span>
        </template>

        <template #mobile-card="{ row }">
          <div class="deactivated-page__mobile-card">
            <GlowImage :src="row.coverUrl as string" alt="" :size="48"
              :fallback-src="(row.coverFallbackUrl as string | null | undefined) ?? null" />
            <div class="deactivated-page__mobile-info">
              <span class="deactivated-page__song-name">{{ row.songName }}</span>
              <span class="deactivated-page__song-meta">{{ row.songAuthor }} - {{ row.mapper }}</span>
              <div class="deactivated-page__mobile-meta">
                <ComplexityBadge
                  v-if="row.complexity != null"
                  :complexity="row.complexity as number"
                />
                <span class="deactivated-page__date">{{ formatRelativeDate(row.createdAt as string) }}</span>
              </div>
            </div>
          </div>
        </template>

        <template #empty>
          <EmptyState message="No deactivated maps." />
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
.deactivated-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  max-width: 1030px;
  margin: 0 auto;
  width: 100%;
}

.deactivated-page__controls {
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  gap: var(--space-md);
}

.deactivated-page__filters {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
  width: 100%;
}

.deactivated-page__song-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.deactivated-page__song-name {
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.deactivated-page__song-meta {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.deactivated-page__category {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.deactivated-page__category-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.deactivated-page__date {
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.deactivated-page__by {
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.deactivated-page__muted {
  color: var(--text-tertiary);
}

.deactivated-page__mobile-card {
  display: flex;
  gap: var(--space-md);
  padding: var(--space-md);
}

.deactivated-page__mobile-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.deactivated-page__mobile-meta {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-top: var(--space-xs);
}

@media (max-width: 767px) {
  .deactivated-page__controls {
    flex-direction: column;
    align-items: stretch;
  }

  .deactivated-page__filters {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
