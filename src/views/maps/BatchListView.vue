<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import MapCardCompact from '@/components/domain/MapCardCompact.vue'
import { usePlaylistDownload } from '@/composables/usePlaylistDownload'
import { useCategoryStore } from '@/stores/categories'
import type { PublicBatchResponse } from '@/types/api/batches'
import type { MapDisplay } from '@/types/display'
import { groupBatchByCategory } from '@/utils/batches'
import { formatRelativeDate } from '@/utils/formatters'
import type { RouteLocationRaw } from 'vue-router'

defineProps<{
  batches: PublicBatchResponse[]
  loading: boolean
  mapRouteTo: (m: Pick<MapDisplay, 'id' | 'difficultyId' | 'difficulty' | 'characteristic' | 'beatsaverCode'>) => RouteLocationRaw
}>()

const categoryStore = useCategoryStore()
const { downloadBatchPlaylist } = usePlaylistDownload()

function batchDifficultiesByCategory(batch: PublicBatchResponse) {
  return groupBatchByCategory(
    batch,
    (id) => categoryStore.getCategoryCode(id),
    (code) => categoryStore.getAccent(code),
    (code) => categoryStore.getCategoryInfo(code)?.name ?? code,
  )
}
</script>

<template>
  <div v-if="loading" class="batch-skeletons">
    <SkeletonLoader v-for="i in 3" :key="i" variant="card" />
  </div>
  <EmptyState v-else-if="batches.length === 0" message="No released batches found." />
  <div v-else class="batches">
    <div v-for="batch in batches" :key="batch.id" class="batch">
      <div class="batch-header">
        <div class="batch-header-top">
          <div class="batch-heading">
            <h2 class="batch-name">{{ batch.name }}</h2>
            <div class="batch-meta">
              <span class="batch-count">{{ batch.difficulties.length }} difficulties</span>
              <span v-if="batch.releasedAt" class="batch-date">{{ formatRelativeDate(batch.releasedAt) }}</span>
            </div>
          </div>
          <BaseButton size="sm" class="batch-download" :aria-label="`Download ${batch.name} playlist`"
            @click="downloadBatchPlaylist(batch.id, batch.name)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Playlist</span>
          </BaseButton>
        </div>
        <p v-if="batch.description" class="batch-desc">{{ batch.description }}</p>
      </div>
      <div v-for="group in batchDifficultiesByCategory(batch)" :key="group.categoryCode" class="batch-category">
        <div class="batch-cat-header">
          <span class="batch-cat-dot" :style="{ background: group.accent }" />
          <span class="batch-cat-name">{{ group.name }}</span>
        </div>
        <div class="batch-cards">
          <MapCardCompact v-for="m in group.diffs" :key="m.difficultyId" :map="m" :to="mapRouteTo(m)" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.batches {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

.batch {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.batch-header {
  padding: var(--space-md);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
}

.batch-header-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
}

.batch-heading {
  min-width: 0;
}

.batch-name {
  font-size: var(--text-section);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  overflow-wrap: anywhere;
}

.batch-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
  margin-top: var(--space-xs);
}

.batch-count,
.batch-date {
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.batch-desc {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  margin: var(--space-sm) 0 0;
}

.batch-download {
  flex-shrink: 0;
}

.batch-category {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding-left: var(--space-md);
}

.batch-cat-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.batch-cat-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.batch-cat-name {
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.batch-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-sm);
}

.batch-skeletons {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

@media (max-width: 767px) {
  .batch-header-top {
    align-items: stretch;
    flex-direction: column;
  }

  .batch-download {
    align-self: flex-start;
  }
}
</style>
