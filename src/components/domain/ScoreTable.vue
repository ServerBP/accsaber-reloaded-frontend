<script setup lang="ts">
import BaseSelect from '@/components/common/BaseSelect.vue'
import DataTable from '@/components/common/DataTable.vue'
import PaginationControls from '@/components/common/PaginationControls.vue'
import type { SortState, TableColumn } from '@/types/display'
import type { RouteLocationRaw } from 'vue-router'
import { formatRelativeDate, isRecentDate } from '@/utils/formatters'
import { getRankClass } from '@/utils/ranking'
import { computed, useSlots } from 'vue'

const props = withDefaults(defineProps<{
  columns: TableColumn[]
  rows: Record<string, unknown>[]
  sortState?: SortState
  loading?: boolean
  loadingRows?: number
  emptyMessage?: string
  rowClickable?: boolean
  rowTo?: (row: Record<string, unknown>) => RouteLocationRaw | undefined
  rowKey?: string | ((row: Record<string, unknown>, index: number) => string | number)
  page?: number
  totalPages?: number
  medalRanks?: boolean
  rowClass?: (row: Record<string, unknown>, index: number) => string | Record<string, boolean> | undefined
}>(), {
  loadingRows: 8,
  emptyMessage: 'No scores found',
  totalPages: 0,
})

const emit = defineEmits<{
  sort: [key: string]
  rowClick: [row: Record<string, unknown>, index: number]
  'update:page': [page: number]
}>()

const slots = useSlots()

const SHORT_LABEL_MAP: Record<string, string> = {
  '#': 'Rank',
  'Acc': 'Accuracy',
  'AP': 'AP',
  '115s': '115 streak',
  'Diff': 'Difficulty',
  'COMP': 'Complexity',
}

const sortOptions = computed(() =>
  props.columns
    .filter((c) => c.sortable)
    .map((c) => ({ value: c.key, label: SHORT_LABEL_MAP[c.label] ?? c.label })),
)

function onSortKeySelect(key: string) {
  if (!key || props.sortState?.key === key) return
  emit('sort', key)
}

function onDirectionToggle() {
  if (props.sortState) emit('sort', props.sortState.key)
}

const BUILT_IN_CELLS = new Set([
  'cell-rank', 'cell-leaderboardRank',
  'cell-accuracy', 'cell-score', 'cell-ap', 'cell-weighted', 'cell-date',
])

const customSlots = computed(() => {
  const result: Record<string, unknown> = {}
  for (const name of Object.keys(slots)) {
    if (!BUILT_IN_CELLS.has(name)) {
      result[name] = slots[name]
    }
  }
  return result
})

</script>

<template>
  <div class="score-table">
    <div v-if="sortOptions.length > 0 && !loading && rows.length > 0" class="score-table__mobile-sort">
      <BaseSelect class="score-table__mobile-sort-select" :model-value="sortState?.key ?? ''" :options="sortOptions"
        placeholder="Sort by..." @update:model-value="onSortKeySelect" />
      <button class="score-table__sort-dir" type="button"
        :aria-label="sortState?.direction === 'asc' ? 'Sort descending' : 'Sort ascending'"
        :title="sortState?.direction === 'asc' ? 'Ascending' : 'Descending'"
        @click="onDirectionToggle">
        <svg v-if="sortState?.direction === 'asc'" width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 11V3M7 3L3.5 6.5M7 3L10.5 6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
            stroke-linejoin="round" />
        </svg>
        <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 3V11M7 11L3.5 7.5M7 11L10.5 7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
            stroke-linejoin="round" />
        </svg>
      </button>
    </div>

    <DataTable
      :columns="columns"
      :rows="rows"
      :sort-state="sortState"
      :loading="loading"
      :loading-rows="loadingRows"
      :row-clickable="rowClickable"
      :row-to="rowTo"
      :row-key="rowKey"
      :row-class="rowClass"
      :empty-message="emptyMessage"
      @sort="emit('sort', $event)"
      @row-click="(row, index) => emit('rowClick', row, index)"
    >
      <template #cell-rank="sp">
        <slot name="cell-rank" v-bind="sp">
          <span class="score-table__rank" :class="medalRanks ? getRankClass(sp.value as number) : ''">
            #{{ sp.value }}
          </span>
        </slot>
      </template>

      <template #cell-leaderboardRank="sp">
        <slot name="cell-leaderboardRank" v-bind="sp">
          <span class="score-table__rank" :class="medalRanks ? getRankClass(sp.value as number) : ''">
            #{{ sp.value }}
          </span>
        </slot>
      </template>

      <template #cell-accuracy="sp">
        <slot name="cell-accuracy" v-bind="sp">
          {{ ((sp.value as number) * 100).toFixed(2) }}%
        </slot>
      </template>

      <template #cell-score="sp">
        <slot name="cell-score" v-bind="sp">
          <span class="score-table__secondary">{{ (sp.value as number).toLocaleString() }}</span>
        </slot>
      </template>

      <template #cell-ap="sp">
        <slot name="cell-ap" v-bind="sp">
          <span class="score-table__ap">{{ (sp.value as number).toFixed(2) }}</span>
        </slot>
      </template>

      <template #cell-weighted="sp">
        <slot name="cell-weighted" v-bind="sp">
          <span class="score-table__secondary">{{ (sp.value as number).toFixed(2) }}</span>
        </slot>
      </template>

      <template #cell-date="sp">
        <slot name="cell-date" v-bind="sp">
          <span class="score-table__date" :class="{ 'score-table__date--recent': isRecentDate(sp.value as string) }">
            {{ formatRelativeDate(sp.value as string) }}
          </span>
        </slot>
      </template>

      <template v-for="(_, name) in customSlots" :key="name" #[name]="sp">
        <slot :name="(name as string)" v-bind="sp" />
      </template>
    </DataTable>

    <PaginationControls
      v-if="totalPages > 1"
      :page="page ?? 1"
      :total-pages="totalPages"
      @update:page="emit('update:page', $event)"
    />
  </div>
</template>

<style scoped>
.score-table {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.score-table__rank {
  font-family: var(--font-mono);
  font-weight: 500;
  color: var(--text-secondary);
}

.score-table__rank.rank--gold { color: var(--tier-gold); font-weight: 700; }
.score-table__rank.rank--silver { color: var(--tier-silver); font-weight: 700; }
.score-table__rank.rank--bronze { color: var(--tier-bronze); font-weight: 700; }

.score-table__ap {
  font-weight: 500;
}

.score-table__secondary {
  color: var(--text-secondary);
}

.score-table__date {
  white-space: nowrap;
  color: var(--text-secondary);
}

.score-table__date--recent {
  color: var(--text-primary);
}

.score-table__mobile-sort {
  display: none;
}

.score-table__mobile-sort-select {
  flex: 1;
  min-width: 0;
}

.score-table__sort-dir {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  flex-shrink: 0;
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  background: var(--bg-base);
  color: var(--text-secondary);
  cursor: pointer;
  transition: border-color 120ms ease, color 120ms ease;
}

.score-table__sort-dir:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

@media (max-width: 767px) {
  .score-table__mobile-sort {
    display: flex;
    gap: var(--space-sm);
    align-items: stretch;
  }
}
</style>
