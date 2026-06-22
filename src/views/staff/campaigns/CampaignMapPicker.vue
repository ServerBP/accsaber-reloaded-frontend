<script setup lang="ts">
import { getDifficulties } from '@/api/maps'
import { getApiErrorMessage } from '@/api/client'
import BaseModal from '@/components/common/BaseModal.vue'
import FilterButton from '@/components/common/FilterButton.vue'
import PaginationControls from '@/components/common/PaginationControls.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import CategoryBadge from '@/components/domain/CategoryBadge.vue'
import ComplexityBadge from '@/components/domain/ComplexityBadge.vue'
import DifficultyBadge from '@/components/domain/DifficultyBadge.vue'
import { useDebouncedRef } from '@/composables/useDebouncedRef'
import { useCategoryStore } from '@/stores/categories'
import type { PublicMapDifficultyResponse } from '@/types/api/maps'
import type { CategoryCode } from '@/types/display'
import { computed, onMounted, ref, watch } from 'vue'
import MapFilterSidebar from '@/views/maps/MapFilterSidebar.vue'

defineProps<{ loading?: boolean }>()

const emit = defineEmits<{
  close: []
  pick: [mapDifficultyId: string]
}>()

const categoryStore = useCategoryStore()

const PAGE_SIZE = 12

const query = ref('')
const debounced = useDebouncedRef(query, 220)
const page = ref(1)
const totalPages = ref(1)
const results = ref<PublicMapDifficultyResponse[]>([])
const fetching = ref(false)
const err = ref<string | null>(null)

const filtersOpen = ref(false)
const selectedCategories = ref<string[]>([])
const complexityRange = ref<[number, number]>([0, 20])

const hasActiveFilters = computed(() =>
  selectedCategories.value.length > 0
  || complexityRange.value[0] > 0
  || complexityRange.value[1] < 20,
)

watch([debounced, selectedCategories, complexityRange], () => { page.value = 1 })

async function search() {
  fetching.value = true
  err.value = null
  try {
    const params: Record<string, unknown> = {
      page: page.value - 1,
      size: PAGE_SIZE,
      status: 'RANKED',
      search: debounced.value || undefined,
      sort: 'rankedAt,desc',
    }
    if (selectedCategories.value.length === 1) {
      params.categoryId = selectedCategories.value[0]
    }
    if (complexityRange.value[0] > 0) {
      params.complexityMin = complexityRange.value[0]
    }
    if (complexityRange.value[1] < 20) {
      params.complexityMax = complexityRange.value[1]
    }
    const data = await getDifficulties(params as never)
    results.value = data.content
    totalPages.value = data.totalPages || 1
    if (page.value > totalPages.value) page.value = totalPages.value
  } catch (e) {
    err.value = getApiErrorMessage(e, 'Search failed')
    results.value = []
    totalPages.value = 1
  } finally {
    fetching.value = false
  }
}

onMounted(search)

watch([debounced, page, selectedCategories, complexityRange], () => {
  void search()
})

function categoryCodeFor(diff: PublicMapDifficultyResponse): CategoryCode {
  return categoryStore.getCategoryCode(diff.categoryId) ?? 'overall'
}

function pick(diff: PublicMapDifficultyResponse) {
  emit('pick', diff.id)
}

const characteristicHint = computed(() => (diff: PublicMapDifficultyResponse) => {
  if (!diff.characteristic) return null
  if (diff.characteristic.toLowerCase() === 'standard') return null
  return diff.characteristic
})
</script>

<template>
  <BaseModal :open="true" title="Add a node" @close="emit('close')">
    <div class="map-picker">
      <div class="map-picker__head">
        <input class="map-picker__search" v-model="query" type="search" autofocus
          placeholder="Search song, artist, or mapper" />
        <FilterButton :active="filtersOpen || hasActiveFilters" :has-indicator="hasActiveFilters"
          @click="filtersOpen = !filtersOpen" />
      </div>

      <div v-if="filtersOpen" class="map-picker__filters">
        <MapFilterSidebar :selected-categories="selectedCategories" :complexity-range="complexityRange"
          @update:selected-categories="selectedCategories = $event"
          @update:complexity-range="complexityRange = $event" />
      </div>

      <p v-if="err" class="map-picker__error" role="alert">{{ err }}</p>

      <div v-if="fetching" class="map-picker__list">
        <SkeletonLoader v-for="i in 6" :key="i" variant="table-row" />
      </div>

      <p v-else-if="results.length === 0" class="map-picker__empty">No maps match that search.</p>

      <ul v-else class="map-picker__list">
        <li v-for="diff in results" :key="diff.id">
          <button type="button" class="map-picker__row" :disabled="loading" @click="pick(diff)">
            <span class="map-picker__cover">
              <img v-if="diff.coverUrl" :src="diff.coverUrl" :alt="diff.songName" loading="lazy" />
            </span>
            <span class="map-picker__meta">
              <CategoryBadge :category="categoryCodeFor(diff)" size="sm" class="map-picker__cat" />
              <span class="map-picker__title">{{ diff.songName }}</span>
              <span class="map-picker__sub">
                <span>{{ diff.songAuthor }}</span>
                <span class="map-picker__sep" aria-hidden="true">·</span>
                <span>{{ diff.mapAuthor }}</span>
              </span>
            </span>
            <span class="map-picker__diff">
              <DifficultyBadge :difficulty="diff.difficulty" />
              <span v-if="characteristicHint(diff)" class="map-picker__char">{{ characteristicHint(diff) }}</span>
              <ComplexityBadge v-if="diff.complexity != null" :complexity="diff.complexity" />
            </span>
          </button>
        </li>
      </ul>

      <div v-if="!fetching && totalPages > 1" class="map-picker__pagination">
        <PaginationControls :page="page" :total-pages="totalPages"
          @update:page="page = $event" />
      </div>
    </div>
  </BaseModal>
</template>

<style scoped>
.map-picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  width: min(640px, 100%);
  max-height: 78vh;
}

.map-picker__head {
  display: flex;
  align-items: stretch;
  gap: var(--space-sm);
}

.map-picker__head .map-picker__search {
  flex: 1 1 auto;
  min-width: 0;
}

.map-picker__filters {
  padding: var(--space-md);
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
}

.map-picker__search {
  width: 100%;
  padding: 10px 12px;
  font-family: var(--font-sans);
  font-size: var(--text-body);
  color: var(--text-primary);
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
  outline: none;
  transition: border-color 120ms ease;
}

.map-picker__search:focus {
  border-color: var(--page-accent, var(--accent));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--page-accent, var(--accent)) 20%, transparent);
}

.map-picker__error {
  margin: 0;
  padding: 8px 10px;
  font-size: var(--text-caption);
  color: var(--error);
  background: color-mix(in srgb, var(--error) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--error) 35%, transparent);
  border-radius: 3px;
}

.map-picker__empty {
  margin: var(--space-md) 0;
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  text-align: center;
}

.map-picker__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  flex: 1 1 auto;
  min-height: 0;
}

.map-picker__list li { margin: 0; }

.map-picker__row {
  width: 100%;
  display: grid;
  grid-template-columns: 44px 1fr auto;
  gap: var(--space-sm);
  align-items: center;
  padding: 8px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  cursor: pointer;
  text-align: left;
  color: inherit;
  transition: background 120ms ease, border-color 120ms ease;
}

.map-picker__row:hover {
  background: var(--bg-elevated);
  border-color: var(--bg-overlay);
}

.map-picker__row:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.map-picker__cover {
  width: 44px;
  height: 44px;
  border-radius: 3px;
  overflow: hidden;
  background: var(--bg-elevated);
  flex-shrink: 0;
}

.map-picker__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.map-picker__meta {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2px;
  min-width: 0;
}

.map-picker__cat {
  margin-bottom: 2px;
}

.map-picker__title {
  font-family: var(--font-sans);
  font-size: var(--text-body);
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-picker__sub {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-picker__sep {
  color: var(--text-tertiary);
}

.map-picker__diff {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
}

.map-picker__char {
  font-family: var(--font-sans);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.map-picker__pagination {
  display: flex;
  justify-content: center;
}
</style>
