<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import GlowImage from '@/components/common/GlowImage.vue'
import PaginationControls from '@/components/common/PaginationControls.vue'
import ComplexityBadge from '@/components/domain/ComplexityBadge.vue'
import MapCardCompact from '@/components/domain/MapCardCompact.vue'
import { usePageMeta } from '@/composables/usePageMeta'
import { usePlaylistDownload } from '@/composables/usePlaylistDownload'
import { useAuthStore } from '@/stores/auth'
import { useCategoryStore } from '@/stores/categories'
import type { BatchResponse } from '@/types/api/batches'
import type { MapDisplay } from '@/types/display'
import { CATEGORY_ORDER } from '@/utils/constants'
import { formatRelativeDate } from '@/utils/formatters'
import { toMapDisplay } from '@/utils/mappers'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const categoryStore = useCategoryStore()
const { downloadBatchPlaylist } = usePlaylistDownload()

usePageMeta({
  title: 'Batches | AccSaber Ranking',
  description: 'Manage ranking batches.',
})

const isHead = computed(() => authStore.hasRole('RANKING_HEAD'))

const batches = ref<BatchResponse[]>([])
const totalPages = ref(0)
const loading = ref(true)
const page = ref(1)

const statusFilter = computed<string>({
  get() { return (route.query.status as string) || '' },
  set(val) {
    const query = { ...route.query }
    if (!val) { delete query.status } else { query.status = val }
    delete query.page
    router.replace({ query })
  },
})

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'RELEASE_READY', label: 'Release Ready' },
  { value: 'RELEASED', label: 'Released' },
]

async function fetchBatches() {
  loading.value = true
  try {
    const { listBatches } = await import('@/api/ranking/batches')
    const params: Record<string, unknown> = {
      page: page.value - 1,
      size: 20,
      sort: 'createdAt,desc',
    }
    if (statusFilter.value) params.status = statusFilter.value
    const res = await listBatches(params)
    batches.value = res.content
    totalPages.value = res.totalPages
  } catch {
    batches.value = []
    totalPages.value = 0
  }
  loading.value = false
}

watch([statusFilter, page], fetchBatches, { immediate: true })


function batchDiffsByCategory(batch: BatchResponse) {
  const groups = new Map<string, { code: string; name: string; accent: string; maps: MapDisplay[] }>()

  for (const diff of batch.difficulties) {
    const code = categoryStore.getCategoryCode(diff.categoryId) ?? 'overall'
    if (!groups.has(code)) {
      const info = categoryStore.getCategoryInfo(code)
      groups.set(code, {
        code,
        name: info?.name ?? code,
        accent: info?.accent ?? '#a855f7',
        maps: [],
      })
    }
    groups.get(code)!.maps.push(toMapDisplay(diff, (id) => categoryStore.getCategoryCode(id)))
  }

  return [...groups.values()].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.code) - CATEGORY_ORDER.indexOf(b.code)
  )
}

const showReleaseConfirm = ref(false)
const releaseBatchTarget = ref<BatchResponse | null>(null)
const releaseLoading = ref(false)

async function handleRelease() {
  if (!releaseBatchTarget.value) return
  releaseLoading.value = true
  try {
    const { releaseBatch } = await import('@/api/ranking/batches')
    await releaseBatch(releaseBatchTarget.value.id)
    showReleaseConfirm.value = false
    releaseBatchTarget.value = null
    await fetchBatches()
  } catch {
  } finally {
    releaseLoading.value = false
  }
}

function openBuilder(batchId?: string) {
  router.push({ name: 'ranking-batch-builder', params: batchId ? { batchId } : {} })
}

function mapRouteTo(map: MapDisplay) {
  return { name: 'ranking-map-detail', params: { difficultyId: map.difficultyId } }
}

const expandedBatch = ref<string | null>(null)

function toggleBatch(batchId: string) {
  expandedBatch.value = expandedBatch.value === batchId ? null : batchId
}

function batchStatusClass(status: string): string {
  if (status === 'RELEASED') return 'batch-status--released'
  if (status === 'RELEASE_READY') return 'batch-status--ready'
  return 'batch-status--draft'
}
</script>

<template>
  <div class="batches-page">
    <div class="batches-page__header">
      <h1 class="batches-page__title">Batches</h1>
      <div class="batches-page__controls">
        <BaseSelect v-model="statusFilter" :options="statusOptions" />
        <BaseButton v-if="isHead" variant="primary" size="sm" @click="openBuilder()">
          Create Batch
        </BaseButton>
      </div>
    </div>

    <div v-if="loading" class="batches-page__loading">
      <div v-for="i in 4" :key="i" class="batches-page__skeleton" />
    </div>

    <EmptyState v-else-if="batches.length === 0" message="No batches found" />

    <div v-else class="batches-page__list">
      <div
        v-for="batch in batches"
        :key="batch.id"
        class="batches-page__batch"
      >
        <div class="batches-page__batch-header" @click="toggleBatch(batch.id)">
          <div class="batches-page__batch-info">
            <h2 class="batches-page__batch-name">{{ batch.name }}</h2>
            <div class="batches-page__batch-meta">
              <span>{{ batch.difficulties.length }} difficulties</span>
              <span v-if="batch.releasedAt">{{ formatRelativeDate(batch.releasedAt) }}</span>
              <span v-else>{{ formatRelativeDate(batch.createdAt) }}</span>
            </div>
          </div>
          <span class="batches-page__batch-status" :class="batchStatusClass(batch.status)">
            {{ batch.status.replace('_', ' ') }}
          </span>
          <div class="batches-page__batch-actions" @click.stop>
            <BaseButton
              v-if="batch.difficulties.length"
              size="sm"
              class="batches-page__batch-download"
              :aria-label="`Download ${batch.name} playlist`"
              @click="downloadBatchPlaylist(batch.id, batch.name)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Playlist</span>
            </BaseButton>
            <template v-if="isHead">
              <BaseButton
                v-if="batch.status === 'DRAFT'"
                size="sm"
                @click="openBuilder(batch.id)"
              >
                Edit
              </BaseButton>
              <BaseButton
                v-if="batch.status === 'RELEASE_READY'"
                size="sm"
                variant="primary"
                @click="releaseBatchTarget = batch; showReleaseConfirm = true"
              >
                Release
              </BaseButton>
            </template>
          </div>
          <svg
            class="batches-page__chevron"
            :class="{ 'batches-page__chevron--open': expandedBatch === batch.id }"
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        <div v-if="expandedBatch === batch.id && batch.difficulties.length" class="batches-page__batch-categories">
          <div
            v-for="group in batchDiffsByCategory(batch)"
            :key="group.code"
            class="batches-page__cat-group"
          >
            <div class="batches-page__cat-header">
              <span class="batches-page__cat-dot" :style="{ background: group.accent }" />
              <span class="batches-page__cat-name">{{ group.name }}</span>
            </div>
            <div class="batches-page__cat-cards">
              <MapCardCompact
                v-for="map in group.maps"
                :key="map.difficultyId"
                :map="map"
                :to="mapRouteTo(map)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <PaginationControls
      v-if="totalPages > 1"
      :page="page"
      :total-pages="totalPages"
      @update:page="page = $event"
    />

    <BaseModal :open="showReleaseConfirm" title="Release Batch" max-width="420px" @close="showReleaseConfirm = false">
      <p style="color: var(--text-secondary); margin: 0">
        Release <strong>{{ releaseBatchTarget?.name }}</strong> with {{ releaseBatchTarget?.difficulties.length }} difficulties?
        This will rank all maps in the batch and trigger score backfill. This action is irreversible.
      </p>
      <template #footer>
        <div style="display: flex; gap: var(--space-sm); justify-content: flex-end">
          <BaseButton @click="showReleaseConfirm = false">Cancel</BaseButton>
          <BaseButton variant="destructive" :loading="releaseLoading" @click="handleRelease">Release</BaseButton>
        </div>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.batches-page {
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--space-xl) var(--space-xl) var(--space-3xl);
}

.batches-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-lg);
  flex-wrap: wrap;
  gap: var(--space-md);
}

.batches-page__title {
  font-size: var(--text-page-title);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.batches-page__controls {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.batches-page__loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.batches-page__skeleton {
  height: 80px;
  background: var(--bg-surface);
  border-radius: var(--radius-card);
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

.batches-page__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

.batches-page__batch {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.batches-page__batch-header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  cursor: pointer;
  transition: background 120ms ease;
}

.batches-page__batch-header:hover {
  background: var(--bg-elevated);
}

.batches-page__chevron {
  color: var(--text-tertiary);
  transition: transform 150ms ease;
  flex-shrink: 0;
}

.batches-page__chevron--open {
  transform: rotate(180deg);
}

.batches-page__batch-info {
  flex: 1;
  min-width: 0;
}

.batches-page__batch-name {
  font-size: var(--text-section);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.batches-page__batch-meta {
  display: flex;
  gap: var(--space-md);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  margin-top: 2px;
}


.batches-page__batch-status {
  font-size: var(--text-caption);
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  flex-shrink: 0;
}

.batch-status--draft {
  background: color-mix(in srgb, var(--text-tertiary) 15%, transparent);
  color: var(--text-secondary);
}

.batch-status--ready {
  background: color-mix(in srgb, var(--info) 15%, transparent);
  color: var(--info);
}

.batch-status--released {
  background: color-mix(in srgb, var(--success) 15%, transparent);
  color: var(--success);
}

.batches-page__batch-actions {
  display: flex;
  gap: var(--space-xs);
  flex-shrink: 0;
}

.batches-page__batch-download {
  flex-shrink: 0;
}

.batches-page__batch-categories {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.batches-page__cat-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.batches-page__cat-header {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.batches-page__cat-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.batches-page__cat-name {
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.batches-page__cat-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-sm);
}

@media (max-width: 767px) {
  .batches-page {
    padding: var(--space-md) var(--space-md) var(--space-2xl);
  }

  .batches-page__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .batches-page__batch-header {
    flex-direction: column;
    padding: var(--space-md);
  }

  .batches-page__cat-cards {
    grid-template-columns: 1fr;
  }
}
</style>
