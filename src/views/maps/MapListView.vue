<script setup lang="ts">
import DataTable from '@/components/common/DataTable.vue'
import GlowImage from '@/components/common/GlowImage.vue'
import ComplexityBadge from '@/components/domain/ComplexityBadge.vue'
import DifficultyBadge from '@/components/domain/DifficultyBadge.vue'
import { useCategoryStore } from '@/stores/categories'
import type { TableColumn } from '@/types/display'
import { formatRelativeDate } from '@/utils/formatters'
import type { RouteLocationRaw } from 'vue-router'

defineProps<{
  rows: Record<string, unknown>[]
  loading: boolean
  sortState: { key: string; direction: 'asc' | 'desc' }
  rowTo: (row: Record<string, unknown>) => RouteLocationRaw
}>()

const emit = defineEmits<{ sort: [key: string] }>()

const categoryStore = useCategoryStore()

const listColumns: TableColumn[] = [
  { key: 'cover', label: '', width: '56px' },
  { key: 'songName', label: 'Name', sortable: true, align: 'left' },
  { key: 'artistName', label: 'Artist', align: 'left' },
  { key: 'mapperName', label: 'Mapper', align: 'left' },
  { key: 'category', label: 'Category', sortable: true, align: 'center', width: '100px' },
  { key: 'difficulty', label: 'Difficulty', align: 'center', width: '100px' },
  { key: 'complexity', label: 'Complexity', sortable: true, align: 'center', width: '100px' },
  { key: 'totalScores', label: 'Scores', sortable: true, align: 'right', mono: true, width: '80px' },
  { key: 'rankedAt', label: 'Released', sortable: true, align: 'right', width: '100px' },
]
</script>

<template>
  <DataTable :columns="listColumns" :rows="rows" :sort-state="sortState" :loading="loading" :loading-rows="10"
    :row-to="rowTo" row-key="difficultyId" empty-message="No maps found matching your filters."
    @sort="emit('sort', $event)">
    <template #cell-cover="{ row }">
      <GlowImage v-if="row.cover" :src="(row.cover as string)" :alt="(row.songName as string)" :size="44"
        :fallback-src="(row.coverFallback as string | null | undefined) ?? null" />
    </template>
    <template #cell-songName="{ row }">
      <div class="name-cell">
        <span class="name">{{ row.songName }}</span>
        <span class="diff-label">{{ row.difficultyLabel }}</span>
      </div>
    </template>
    <template #cell-category="{ row }">
      <span class="category" :style="{ '--cat-accent': categoryStore.getAccent(row.categoryCode as string) }">
        {{ row.category }}
      </span>
    </template>
    <template #cell-difficulty="{ row }">
      <DifficultyBadge :difficulty="row.difficulty as string" />
    </template>
    <template #cell-complexity="{ row }">
      <ComplexityBadge :complexity="row.complexity as number" />
    </template>
    <template #cell-totalScores="{ value }">
      <span class="mono">{{ (value as number).toLocaleString() }}</span>
    </template>
    <template #cell-rankedAt="{ value }">
      <span v-if="value" class="date">{{ formatRelativeDate(value as string) }}</span>
    </template>

    <template #mobile-card="{ row }">
      <router-link :to="rowTo(row)" class="list-card">
        <GlowImage v-if="row.cover" :src="(row.cover as string)" :alt="(row.songName as string)" :size="48"
          class="list-card-cover" :fallback-src="(row.coverFallback as string | null | undefined) ?? null" />
        <div v-else class="list-card-cover-placeholder" />
        <div class="list-card-info">
          <span class="name">{{ row.songName }}</span>
          <span class="list-card-meta">{{ row.artistName }} · {{ row.mapperName }}</span>
        </div>
        <div class="list-card-badges">
          <DifficultyBadge :difficulty="(row.difficulty as string)" />
          <ComplexityBadge :complexity="row.complexity as number" />
        </div>
      </router-link>
    </template>
  </DataTable>
</template>

<style scoped>
.name-cell {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.name {
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.diff-label {
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.category {
  color: var(--cat-accent);
  font-size: var(--text-caption);
}

.mono {
  font-family: var(--font-mono);
}

.date {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  white-space: nowrap;
}

.list-card {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md) var(--space-sm) var(--space-sm);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-left: 2px solid transparent;
  border-radius: var(--radius-card);
  cursor: pointer;
  min-height: 48px;
  text-decoration: none;
  color: inherit;
  transition: border-color 120ms ease;
}

.list-card:hover {
  border-left-color: var(--text-tertiary);
}

.list-card-cover {
  flex-shrink: 0;
  margin-left: var(--space-xs);
}

.list-card-cover-placeholder {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  margin-left: var(--space-xs);
  border-radius: var(--radius-avatar);
  background: var(--bg-overlay);
}

.list-card-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.list-card-meta {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-card-badges {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-xs);
  flex-shrink: 0;
}
</style>
