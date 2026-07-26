<script setup lang="ts">
import { getDifficulties } from '@/api/maps'
import { getApiErrorMessage } from '@/api/client'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import FilterButton from '@/components/common/FilterButton.vue'
import PaginationControls from '@/components/common/PaginationControls.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import CategoryBadge from '@/components/domain/CategoryBadge.vue'
import ComplexityBadge from '@/components/domain/ComplexityBadge.vue'
import DifficultyBadge from '@/components/domain/DifficultyBadge.vue'
import { pickCoverUrl } from '@/composables/useAvatarFallback'
import { useDebouncedRef } from '@/composables/useDebouncedRef'
import { useCategoryStore } from '@/stores/categories'
import type { ImportCampaignMapRequest } from '@/types/api/campaigns'
import type { PublicMapDifficultyResponse } from '@/types/api/maps'
import type { CategoryCode } from '@/types/display'
import { QUEUE_STATUSES } from '@/utils/constants'
import { computed, onMounted, ref, watch } from 'vue'
import MapFilterSidebar from '@/views/maps/MapFilterSidebar.vue'
import CampaignGlobalMapSearch from './CampaignGlobalMapSearch.vue'

const props = withDefaults(
  defineProps<{
    loading?: boolean
    globalSubmit?: (ids: ImportCampaignMapRequest) => Promise<{ attached: boolean }>
    initialGenreSlugs?: string[]
    usedDifficultyIds?: string[]
  }>(),
  { usedDifficultyIds: () => [] },
)

const emit = defineEmits<{
  close: []
  pick: [difficulties: PublicMapDifficultyResponse[]]
}>()

const categoryStore = useCategoryStore()

const PAGE_SIZE = 12

const source = ref<'system' | 'global'>('system')

type StatusFilterKey = 'RANKED' | 'QUEUE'
const STATUS_OPTIONS: Array<{ value: StatusFilterKey; label: string }> = [
  { value: 'RANKED', label: 'Ranked' },
  { value: 'QUEUE', label: 'In queue' },
]
const statusFilter = ref<StatusFilterKey>('RANKED')

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

const multi = ref(false)
const staged = ref<PublicMapDifficultyResponse[]>([])

const stagedIds = computed(() => new Set(staged.value.map((d) => d.id)))

const usedIds = computed(() => new Set(props.usedDifficultyIds))

const hasActiveFilters = computed(
  () =>
    selectedCategories.value.length > 0 ||
    complexityRange.value[0] > 0 ||
    complexityRange.value[1] < 20,
)

watch([debounced, selectedCategories, complexityRange, statusFilter], () => {
  page.value = 1
})

async function search() {
  fetching.value = true
  err.value = null
  try {
    const params: Record<string, unknown> = {
      page: page.value - 1,
      size: PAGE_SIZE,
      status: statusFilter.value === 'RANKED' ? 'RANKED' : QUEUE_STATUSES,
      search: debounced.value || undefined,
      sort: statusFilter.value === 'RANKED' ? 'rankedAt,desc' : 'createdAt,desc',
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

watch([debounced, page, selectedCategories, complexityRange, statusFilter], () => {
  if (source.value === 'system') void search()
})

function categoryCodeFor(diff: PublicMapDifficultyResponse): CategoryCode {
  return categoryStore.getCategoryCode(diff.categoryId) ?? 'overall'
}

const characteristicHint = computed(() => (diff: PublicMapDifficultyResponse) => {
  if (!diff.characteristic) return null
  if (diff.characteristic.toLowerCase() === 'standard') return null
  return diff.characteristic
})

function setMulti(value: boolean) {
  multi.value = value
  if (!value) staged.value = []
}

function rowClick(diff: PublicMapDifficultyResponse) {
  if (props.loading) return
  if (!multi.value) {
    emit('pick', [diff])
    return
  }
  if (stagedIds.value.has(diff.id)) {
    staged.value = staged.value.filter((d) => d.id !== diff.id)
  } else {
    staged.value = [...staged.value, diff]
  }
}

function removeStaged(id: string) {
  staged.value = staged.value.filter((d) => d.id !== id)
}

function commit() {
  if (staged.value.length === 0) return
  emit('pick', staged.value)
}
</script>

<template>
  <BaseModal :open="true" title="Add nodes" max-width="900px" @close="emit('close')">
    <div class="map-picker" :class="{ 'map-picker--multi': multi && source === 'system' }">
      <div v-if="globalSubmit" class="map-picker__source" role="radiogroup" aria-label="Map source">
        <button
          type="button"
          role="radio"
          :aria-checked="source === 'system'"
          class="map-picker__mode-btn"
          :class="{ 'map-picker__mode-btn--active': source === 'system' }"
          @click="source = 'system'"
        >
          This system
        </button>
        <button
          type="button"
          role="radio"
          :aria-checked="source === 'global'"
          class="map-picker__mode-btn"
          :class="{ 'map-picker__mode-btn--active': source === 'global' }"
          @click="source = 'global'"
        >
          Global (BeatSaver)
        </button>
      </div>

      <template v-if="source === 'system'">
      <div class="map-picker__head">
        <input
          class="map-picker__search"
          v-model="query"
          type="search"
          autofocus
          placeholder="Search song, artist, or mapper"
        />
        <FilterButton
          :active="filtersOpen || hasActiveFilters"
          :has-indicator="hasActiveFilters"
          @click="filtersOpen = !filtersOpen"
        />
        <div class="map-picker__mode" role="radiogroup" aria-label="Selection mode">
          <button
            type="button"
            role="radio"
            :aria-checked="!multi"
            class="map-picker__mode-btn"
            :class="{ 'map-picker__mode-btn--active': !multi }"
            @click="setMulti(false)"
          >
            Single
          </button>
          <button
            type="button"
            role="radio"
            :aria-checked="multi"
            class="map-picker__mode-btn"
            :class="{ 'map-picker__mode-btn--active': multi }"
            @click="setMulti(true)"
          >
            Multiple
          </button>
        </div>
      </div>

      <div class="map-picker__status" role="radiogroup" aria-label="Map status">
        <button
          v-for="s in STATUS_OPTIONS"
          :key="s.value"
          type="button"
          role="radio"
          :aria-checked="statusFilter === s.value"
          class="map-picker__status-btn"
          :class="{ 'map-picker__status-btn--active': statusFilter === s.value }"
          @click="statusFilter = s.value"
        >
          {{ s.label }}
        </button>
      </div>

      <div v-if="filtersOpen" class="map-picker__filters">
        <MapFilterSidebar
          :selected-categories="selectedCategories"
          :complexity-range="complexityRange"
          @update:selected-categories="selectedCategories = $event"
          @update:complexity-range="complexityRange = $event"
        />
      </div>

      <div class="map-picker__panes">
        <section class="map-picker__pane">
          <header class="map-picker__pane-head">
            <span class="map-picker__pane-title">Available</span>
            <span v-if="!multi" class="map-picker__pane-hint">Click a map to add it</span>
          </header>

          <p v-if="err" class="map-picker__error" role="alert">{{ err }}</p>

          <div v-if="fetching" class="map-picker__list">
            <SkeletonLoader v-for="i in 6" :key="i" variant="table-row" />
          </div>

          <p v-else-if="results.length === 0" class="map-picker__empty">
            No maps match that search.
          </p>

          <ul v-else class="map-picker__list">
            <li v-for="diff in results" :key="diff.id">
              <button
                type="button"
                class="map-picker__row"
                :class="{ 'map-picker__row--staged': multi && stagedIds.has(diff.id) }"
                :disabled="loading"
                @click="rowClick(diff)"
              >
                <span class="map-picker__cover">
                  <img v-if="pickCoverUrl(diff)" :src="pickCoverUrl(diff)" :alt="diff.songName" loading="lazy" />
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
                <span class="map-picker__trailing">
                  <span class="map-picker__diff">
                    <span
                      v-if="usedIds.has(diff.id)"
                      class="map-picker__used"
                      title="This difficulty is already a node in this campaign. You can still add it again."
                    >
                      In campaign
                    </span>
                    <DifficultyBadge :difficulty="diff.difficulty" />
                    <span v-if="characteristicHint(diff)" class="map-picker__char">
                      {{ characteristicHint(diff) }}
                    </span>
                    <ComplexityBadge v-if="diff.complexity != null" :complexity="diff.complexity" />
                  </span>
                  <span
                    v-if="multi"
                    class="map-picker__check"
                    :class="{ 'map-picker__check--on': stagedIds.has(diff.id) }"
                    aria-hidden="true"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.4"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                </span>
              </button>
            </li>
          </ul>

          <div v-if="!fetching && totalPages > 1" class="map-picker__pagination">
            <PaginationControls :page="page" :total-pages="totalPages" @update:page="page = $event" />
          </div>
        </section>

        <section v-if="multi" class="map-picker__pane map-picker__pane--selected">
          <header class="map-picker__pane-head">
            <span class="map-picker__pane-title">
              Selected
              <span class="map-picker__pane-count">{{ staged.length }}</span>
            </span>
            <button
              v-if="staged.length > 0"
              type="button"
              class="map-picker__clear"
              @click="staged = []"
            >
              Clear
            </button>
          </header>

          <ul v-if="staged.length > 0" class="map-picker__staged-list">
            <li v-for="d in staged" :key="d.id" class="map-picker__staged">
              <span class="map-picker__cover map-picker__cover--sm">
                <img v-if="pickCoverUrl(d)" :src="pickCoverUrl(d)" :alt="d.songName" loading="lazy" />
              </span>
              <span class="map-picker__staged-meta">
                <span class="map-picker__staged-title">{{ d.songName }}</span>
                <span class="map-picker__staged-sub">{{ d.songAuthor }}</span>
              </span>
              <DifficultyBadge :difficulty="d.difficulty" />
              <button
                type="button"
                class="map-picker__staged-remove"
                aria-label="Remove from selection"
                @click="removeStaged(d.id)"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </li>
          </ul>
          <p v-else class="map-picker__staged-empty">
            Pick maps on the left to stage them here, then add them all at once.
          </p>
        </section>
      </div>
      </template>

      <CampaignGlobalMapSearch
        v-else-if="globalSubmit"
        mode="add"
        :submit="globalSubmit"
        :initial-genre-slugs="initialGenreSlugs"
      />
    </div>

    <template v-if="multi && source === 'system'" #footer>
      <BaseButton @click="emit('close')">Cancel</BaseButton>
      <BaseButton
        variant="primary"
        :disabled="staged.length === 0"
        :loading="loading"
        @click="commit"
      >
        Add {{ staged.length }} {{ staged.length === 1 ? 'node' : 'nodes' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.map-picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  width: min(860px, 100%);
  max-height: min(78vh, 680px);
}

.map-picker__head {
  display: flex;
  align-items: stretch;
  gap: var(--space-sm);
  flex: 0 0 auto;
}

.map-picker__head .map-picker__search {
  flex: 1 1 auto;
  min-width: 0;
}

.map-picker__mode,
.map-picker__source {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
}

.map-picker__source {
  align-self: flex-start;
}

.map-picker__status {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.map-picker__status-btn {
  padding: 4px 10px;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
  cursor: pointer;
  transition:
    color 120ms ease,
    border-color 120ms ease,
    background 120ms ease;
}

.map-picker__status-btn:hover {
  color: var(--text-primary);
}

.map-picker__status-btn--active {
  color: var(--page-accent, var(--accent));
  border-color: var(--page-accent, var(--accent));
  background: color-mix(in srgb, var(--page-accent, var(--accent)) 10%, transparent);
}

.map-picker__mode-btn {
  padding: 4px 12px;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-secondary);
  background: transparent;
  border: none;
  border-radius: 2px;
  cursor: pointer;
  transition:
    color 120ms ease,
    background 120ms ease;
}

.map-picker__mode-btn:hover {
  color: var(--text-primary);
}

.map-picker__mode-btn--active {
  color: var(--page-accent, var(--accent));
  background: var(--bg-elevated);
}

.map-picker__filters {
  flex: 0 0 auto;
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

.map-picker__panes {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-md);
}

.map-picker--multi .map-picker__panes {
  grid-template-columns: 1.5fr 1fr;
}

.map-picker__pane {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  min-height: 0;
}

.map-picker__pane--selected {
  padding-left: var(--space-md);
  border-left: 1px solid var(--bg-overlay);
}

.map-picker__pane-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  flex: 0 0 auto;
}

.map-picker__pane-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.map-picker__pane-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--page-accent, var(--accent));
  background: color-mix(in srgb, var(--page-accent, var(--accent)) 14%, transparent);
  border-radius: 999px;
}

.map-picker__pane-hint {
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  color: var(--text-tertiary);
}

.map-picker__clear {
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: color 120ms ease;
}

.map-picker__clear:hover {
  color: var(--error);
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

.map-picker__empty,
.map-picker__staged-empty {
  margin: var(--space-md) 0;
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  text-align: center;
  line-height: 1.5;
}

.map-picker__list,
.map-picker__staged-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  flex: 1 1 auto;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: var(--bg-overlay) transparent;
}

.map-picker__list::-webkit-scrollbar,
.map-picker__staged-list::-webkit-scrollbar {
  width: 5px;
}

.map-picker__list::-webkit-scrollbar-thumb,
.map-picker__staged-list::-webkit-scrollbar-thumb {
  background: var(--bg-overlay);
  border-radius: 3px;
}

.map-picker__list li,
.map-picker__staged-list li {
  margin: 0;
}

.map-picker__row {
  width: 100%;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  gap: var(--space-sm);
  align-items: center;
  padding: 8px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  cursor: pointer;
  text-align: left;
  color: inherit;
  transition:
    background 120ms ease,
    border-color 120ms ease;
}

.map-picker__row:hover {
  background: var(--bg-elevated);
  border-color: var(--bg-overlay);
}

.map-picker__row--staged {
  border-color: var(--page-accent, var(--accent));
  background: color-mix(in srgb, var(--page-accent, var(--accent)) 8%, transparent);
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

.map-picker__cover--sm {
  width: 34px;
  height: 34px;
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

.map-picker__trailing {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
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

.map-picker__used {
  padding: 2px 6px;
  font-family: var(--font-sans);
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  white-space: nowrap;
  color: var(--text-secondary);
  border: 1px solid var(--bg-overlay);
  border-radius: 2px;
  cursor: help;
}

.map-picker__check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  color: var(--text-tertiary);
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
  opacity: 0.5;
}

.map-picker__check--on {
  color: var(--page-accent, var(--accent));
  border-color: var(--page-accent, var(--accent));
  background: color-mix(in srgb, var(--page-accent, var(--accent)) 14%, transparent);
  opacity: 1;
}

.map-picker__staged {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto auto;
  gap: var(--space-sm);
  align-items: center;
  padding: 6px 8px;
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
}

.map-picker__staged-meta {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.map-picker__staged-title {
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-picker__staged-sub {
  font-family: var(--font-sans);
  font-size: 0.625rem;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-picker__staged-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  color: var(--text-tertiary);
  background: transparent;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  transition:
    color 120ms ease,
    background 120ms ease;
}

.map-picker__staged-remove:hover {
  color: var(--error);
  background: color-mix(in srgb, var(--error) 12%, transparent);
}

.map-picker__pagination {
  flex: 0 0 auto;
  display: flex;
  justify-content: center;
}

@media (max-width: 720px) {
  .map-picker--multi .map-picker__panes {
    grid-template-columns: 1fr;
  }

  .map-picker__pane--selected {
    padding-left: 0;
    border-left: none;
    padding-top: var(--space-md);
    border-top: 1px solid var(--bg-overlay);
  }
}
</style>
