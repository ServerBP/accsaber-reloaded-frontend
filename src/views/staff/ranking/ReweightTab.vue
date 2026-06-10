<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import GlowImage from '@/components/common/GlowImage.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import ComplexityBadge from '@/components/domain/ComplexityBadge.vue'
import { useAuthStore } from '@/stores/auth'
import { useCategoryStore } from '@/stores/categories'
import type { BatchResponse } from '@/types/api/batches'
import type { MapDifficultyResponse, VoteListResponse } from '@/types/api/maps'
import { CATEGORY_ORDER } from '@/utils/constants'
import { formatDifficulty } from '@/utils/mappers'
import { computed, ref, watch } from 'vue'

type Strategy = 'mine' | 'average' | 'combined'

interface ReweightEntry {
  difficulty: MapDifficultyResponse
  original: number
  newComplexity: number
  source: 'my-vote' | 'average' | 'none' | 'manual'
  voteCount: number
  avgComplexity: number | null
  myComplexity: number | null
}

interface LoadedBatch {
  batch: BatchResponse
  entries: Map<string, ReweightEntry>
  reason: string
}

const authStore = useAuthStore()
const categoryStore = useCategoryStore()

const staffId = computed(() => authStore.staffId)

const availableBatches = ref<BatchResponse[]>([])
const batchesLoading = ref(false)
const selectedBatchId = ref('')
const strategy = ref<Strategy>('combined')
const loadingBatch = ref(false)
const loadedBatches = ref<LoadedBatch[]>([])

const showConfirmModal = ref(false)
const submitting = ref(false)
const submitError = ref('')
const submitSuccess = ref('')

const strategyOptions = [
  { value: 'combined', label: 'My votes + fallback avg' },
  { value: 'mine', label: 'My votes only' },
  { value: 'average', label: 'Average of all votes' },
]

const batchOptions = computed(() => [
  { value: '', label: 'Select a batch...' },
  ...availableBatches.value.map((b) => ({
    value: b.id,
    label: `${b.name} (${b.difficulties.length} maps)`,
  })),
])

const alreadyLoadedIds = computed(() =>
  new Set(loadedBatches.value.map((lb) => lb.batch.id))
)

const filteredBatchOptions = computed(() =>
  batchOptions.value.filter((o) => !o.value || !alreadyLoadedIds.value.has(o.value))
)

async function fetchBatches() {
  batchesLoading.value = true
  try {
    const { listBatches } = await import('@/api/ranking/batches')
    const res = await listBatches({ status: 'RELEASED', page: 0, size: 100, sort: 'releasedAt,desc' })
    availableBatches.value = res.content
  } catch {
    availableBatches.value = []
  }
  batchesLoading.value = false
}

fetchBatches()

async function loadBatch() {
  if (!selectedBatchId.value) return
  const batch = availableBatches.value.find((b) => b.id === selectedBatchId.value)
  if (!batch) return

  loadingBatch.value = true
  const entries = new Map<string, ReweightEntry>()

  const { listVotes } = await import('@/api/ranking/voting')

  const votePromises = batch.difficulties.map(async (diff) => {
    let votes: VoteListResponse | null = null
    try {
      votes = await listVotes(diff.id, 'REWEIGHT')
    } catch { }

    const original = diff.complexity ?? 0
    let myComplexity: number | null = null
    let avgComplexity: number | null = null
    let voteCount = 0

    if (votes) {
      const reweightVotes = votes.votes.filter(
        (v) => v.type === 'REWEIGHT' && v.suggestedComplexity != null
      )
      voteCount = reweightVotes.length

      const myVote = reweightVotes.find((v) => v.staffId === staffId.value)
      if (myVote?.suggestedComplexity != null) {
        myComplexity = myVote.suggestedComplexity
      }

      if (reweightVotes.length > 0) {
        const sum = reweightVotes.reduce((acc, v) => acc + (v.suggestedComplexity ?? 0), 0)
        avgComplexity = sum / reweightVotes.length
      }
    }

    let newComplexity = original
    let source: ReweightEntry['source'] = 'none'

    if (strategy.value === 'mine') {
      if (myComplexity != null) {
        newComplexity = myComplexity
        source = 'my-vote'
      }
    } else if (strategy.value === 'average') {
      if (avgComplexity != null) {
        newComplexity = Math.round(avgComplexity * 100) / 100
        source = 'average'
      }
    } else {
      if (myComplexity != null) {
        newComplexity = myComplexity
        source = 'my-vote'
      } else if (avgComplexity != null) {
        newComplexity = Math.round(avgComplexity * 100) / 100
        source = 'average'
      }
    }

    entries.set(diff.id, {
      difficulty: diff,
      original,
      newComplexity,
      source,
      voteCount,
      avgComplexity,
      myComplexity,
    })
  })

  await Promise.all(votePromises)

  loadedBatches.value.push({ batch, entries, reason: '' })
  selectedBatchId.value = ''
  loadingBatch.value = false
}

function removeBatch(index: number) {
  loadedBatches.value.splice(index, 1)
}

function updateComplexity(entry: ReweightEntry, value: number | string) {
  const n = Number(value)
  if (Number.isFinite(n)) {
    entry.newComplexity = n
    entry.source = 'manual'
  }
}

function resetEntry(entry: ReweightEntry) {
  entry.newComplexity = entry.original
  entry.source = 'none'
}

function entriesByCategory(loaded: LoadedBatch) {
  const groups = new Map<string, { code: string; name: string; accent: string; entries: ReweightEntry[] }>()

  for (const entry of loaded.entries.values()) {
    const code = categoryStore.getCategoryCode(entry.difficulty.categoryId) ?? 'overall'
    if (!groups.has(code)) {
      const info = categoryStore.getCategoryInfo(code)
      groups.set(code, {
        code,
        name: info?.name ?? code,
        accent: categoryStore.getAccent(code),
        entries: [],
      })
    }
    groups.get(code)!.entries.push(entry)
  }

  return [...groups.values()].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.code) - CATEGORY_ORDER.indexOf(b.code)
  )
}

const changedEntries = computed(() => {
  const result: { batchIndex: number; batch: LoadedBatch; entry: ReweightEntry }[] = []
  for (let i = 0; i < loadedBatches.value.length; i++) {
    const lb = loadedBatches.value[i]
    for (const entry of lb.entries.values()) {
      if (Math.abs(entry.newComplexity - entry.original) > 0.001) {
        result.push({ batchIndex: i, batch: lb, entry })
      }
    }
  }
  return result
})

const totalChanges = computed(() => changedEntries.value.length)

function sourceLabel(entry: ReweightEntry): string {
  if (entry.source === 'my-vote') {
    if (entry.voteCount > 1 && entry.avgComplexity != null) {
      return `My vote (${entry.voteCount} votes avg: ${entry.avgComplexity.toFixed(2)})`
    }
    return 'My vote'
  }
  if (entry.source === 'average') return `Average (${entry.voteCount} votes)`
  if (entry.source === 'manual') return 'Manual'
  return 'Unchanged'
}

function openConfirm() {
  submitError.value = ''
  submitSuccess.value = ''
  showConfirmModal.value = true
}

async function submitReweight() {
  const missingReason = loadedBatches.value.some(
    (lb) => !lb.reason.trim() && [...lb.entries.values()].some((e) => Math.abs(e.newComplexity - e.original) > 0.001)
  )
  if (missingReason) {
    submitError.value = 'A reason is required for each batch with changes.'
    return
  }

  submitting.value = true
  submitError.value = ''

  try {
    const batchesWithChanges = loadedBatches.value.filter((lb) =>
      [...lb.entries.values()].some((e) => Math.abs(e.newComplexity - e.original) > 0.001)
    )

    if (batchesWithChanges.length === 1) {
      const lb = batchesWithChanges[0]
      const items = [...lb.entries.values()]
        .filter((e) => Math.abs(e.newComplexity - e.original) > 0.001)
        .map((e) => ({ mapDifficultyId: e.difficulty.id, complexity: e.newComplexity }))
      const { reweightBatch } = await import('@/api/ranking/batches')
      await reweightBatch(lb.batch.id, { items, reason: lb.reason.trim() })
    } else {
      const items = batchesWithChanges.flatMap((lb) =>
        [...lb.entries.values()]
          .filter((e) => Math.abs(e.newComplexity - e.original) > 0.001)
          .map((e) => ({ mapDifficultyId: e.difficulty.id, complexity: e.newComplexity }))
      )
      const reason = batchesWithChanges.map((lb) => lb.reason.trim()).filter(Boolean).join('; ')
      const { bulkReweight } = await import('@/api/ranking/maps')
      await bulkReweight({ items, reason })
    }

    submitSuccess.value = `Reweight submitted for ${totalChanges.value} maps. Scores will recalculate in the background.`
    showConfirmModal.value = false
    loadedBatches.value = []
  } catch (e) {
    submitError.value = e instanceof Error ? e.message : 'Failed to submit reweight.'
  } finally {
    submitting.value = false
  }
}

const collapsedBatches = ref<Set<number>>(new Set())

function toggleCollapse(index: number) {
  if (collapsedBatches.value.has(index)) {
    collapsedBatches.value.delete(index)
  } else {
    collapsedBatches.value.add(index)
  }
}
</script>

<template>
  <div class="reweight-tab">
    <div class="reweight-tab__loader">
      <BaseSelect :model-value="selectedBatchId" :options="filteredBatchOptions"
        @update:model-value="selectedBatchId = $event" />
      <BaseSelect :model-value="strategy" :options="strategyOptions"
        @update:model-value="strategy = $event as Strategy" />
      <BaseButton variant="primary" size="sm" :loading="loadingBatch"
        :disabled="!selectedBatchId" @click="loadBatch">
        Load Batch
      </BaseButton>
    </div>

    <div v-if="submitSuccess" class="reweight-tab__success">{{ submitSuccess }}</div>

    <EmptyState v-if="!loadingBatch && loadedBatches.length === 0 && !submitSuccess"
      message="Select a released batch to begin reweighting." />

    <div v-if="loadingBatch" class="reweight-tab__loading">
      <SkeletonLoader variant="card" />
      <SkeletonLoader variant="card" />
      <SkeletonLoader variant="card" />
    </div>

    <div v-for="(loaded, batchIdx) in loadedBatches" :key="loaded.batch.id"
      class="reweight-tab__batch-section">
      <div class="reweight-tab__batch-header" @click="toggleCollapse(batchIdx)">
        <div class="reweight-tab__batch-info">
          <h3 class="reweight-tab__batch-name">{{ loaded.batch.name }}</h3>
          <span class="reweight-tab__batch-count">{{ loaded.entries.size }} difficulties</span>
        </div>
        <div class="reweight-tab__batch-actions">
          <BaseButton size="sm" variant="destructive" @click.stop="removeBatch(batchIdx)">Remove</BaseButton>
          <svg class="reweight-tab__chevron" :class="{ 'reweight-tab__chevron--collapsed': collapsedBatches.has(batchIdx) }"
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      <div v-if="!collapsedBatches.has(batchIdx)" class="reweight-tab__batch-body">
        <div class="reweight-tab__reason-row">
          <label class="reweight-tab__field-label">Reason</label>
          <textarea v-model="loaded.reason" class="reweight-tab__reason-input"
            placeholder="Reason for this reweight (required)" rows="2" />
        </div>

        <div v-for="group in entriesByCategory(loaded)" :key="group.code" class="reweight-tab__category">
          <div class="reweight-tab__category-header">
            <span class="reweight-tab__category-dot" :style="{ background: group.accent }" />
            <span class="reweight-tab__category-name">{{ group.name }}</span>
            <span class="reweight-tab__category-count">({{ group.entries.length }})</span>
          </div>

          <div class="reweight-tab__cards">
            <div v-for="entry in group.entries" :key="entry.difficulty.id" class="reweight-card"
              :class="{ 'reweight-card--changed': Math.abs(entry.newComplexity - entry.original) > 0.001 }">
              <div class="reweight-card__left">
                <GlowImage :src="entry.difficulty.coverUrl" :alt="entry.difficulty.songName" :size="48" />
                <div class="reweight-card__info">
                  <span class="reweight-card__title">{{ entry.difficulty.songName }}</span>
                  <span class="reweight-card__meta">
                    {{ entry.difficulty.songAuthor }} - {{ entry.difficulty.mapAuthor }}
                  </span>
                  <span class="reweight-card__badges">
                    <span class="diff-badge" :class="'diff-badge--' + entry.difficulty.difficulty.toLowerCase()">
                      {{ formatDifficulty(entry.difficulty.difficulty) }}
                    </span>
                  </span>
                </div>
              </div>

              <div class="reweight-card__right">
                <div class="reweight-card__complexity-row">
                  <span class="reweight-card__original">
                    Original: <span class="reweight-card__mono">{{ entry.original.toFixed(2) }}</span>
                  </span>
                  <BaseInput :model-value="entry.newComplexity" type="number" step="0.1" min="0"
                    @update:model-value="updateComplexity(entry, $event)" />
                  <span v-if="Math.abs(entry.newComplexity - entry.original) > 0.001" class="reweight-card__delta"
                    :class="entry.newComplexity > entry.original ? 'reweight-card__delta--up' : 'reweight-card__delta--down'">
                    {{ (entry.newComplexity - entry.original >= 0 ? '+' : '') + (entry.newComplexity - entry.original).toFixed(2) }}
                  </span>
                  <BaseButton size="sm" @click="resetEntry(entry)">Reset</BaseButton>
                </div>
                <div class="reweight-card__slider-row">
                  <input type="range" class="reweight-card__slider"
                    :min="Math.max(0, entry.original - 7)" :max="entry.original + 7" step="0.1"
                    :value="entry.newComplexity"
                    @input="updateComplexity(entry, ($event.target as HTMLInputElement).value)" />
                </div>
                <span class="reweight-card__source">{{ sourceLabel(entry) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loadedBatches.length > 0" class="reweight-tab__footer">
      <BaseButton variant="primary" :disabled="totalChanges === 0" @click="openConfirm">
        Submit Reweight ({{ totalChanges }} maps)
      </BaseButton>
    </div>

    <BaseModal :open="showConfirmModal" title="Confirm Reweight" max-width="640px"
      @close="showConfirmModal = false">
      <div class="confirm-modal">
        <p class="confirm-modal__summary">
          You are about to reweight <strong>{{ totalChanges }}</strong> maps.
        </p>
        <div class="confirm-modal__list">
          <div v-for="item in changedEntries" :key="item.entry.difficulty.id" class="confirm-modal__row">
            <span class="confirm-modal__name">{{ item.entry.difficulty.songName }}</span>
            <span class="confirm-modal__values">
              <span class="confirm-modal__mono">{{ item.entry.original.toFixed(2) }}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
              <span class="confirm-modal__mono"
                :class="item.entry.newComplexity > item.entry.original ? 'reweight-card__delta--up' : 'reweight-card__delta--down'">
                {{ item.entry.newComplexity.toFixed(2) }}
              </span>
            </span>
          </div>
        </div>
        <div v-if="submitError" class="confirm-modal__error">{{ submitError }}</div>
      </div>
      <template #footer>
        <div style="display: flex; gap: var(--space-sm); justify-content: flex-end">
          <BaseButton @click="showConfirmModal = false">Cancel</BaseButton>
          <BaseButton variant="primary" :loading="submitting" @click="submitReweight">
            Confirm & Reweight
          </BaseButton>
        </div>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.reweight-tab {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.reweight-tab__loader {
  display: flex;
  align-items: flex-end;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.reweight-tab__loader > :first-child {
  flex: 1;
  min-width: 200px;
}

.reweight-tab__success {
  padding: var(--space-md);
  background: color-mix(in srgb, var(--success) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--success) 30%, transparent);
  border-radius: var(--radius-card);
  color: var(--success);
  font-size: var(--text-body);
}

.reweight-tab__loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.reweight-tab__batch-section {
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  overflow: hidden;
}

.reweight-tab__batch-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-lg);
  cursor: pointer;
  transition: background 120ms ease;
}

.reweight-tab__batch-header:hover {
  background: var(--bg-elevated);
}

.reweight-tab__batch-info {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.reweight-tab__batch-name {
  font-size: var(--text-card-title);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.reweight-tab__batch-count {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  font-family: var(--font-mono);
}

.reweight-tab__batch-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.reweight-tab__chevron {
  color: var(--text-tertiary);
  transition: transform 150ms ease;
}

.reweight-tab__chevron--collapsed {
  transform: rotate(-90deg);
}

.reweight-tab__batch-body {
  padding: var(--space-md) var(--space-lg) var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.reweight-tab__reason-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.reweight-tab__field-label {
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.reweight-tab__reason-input {
  width: 100%;
  min-height: 52px;
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-btn);
  color: var(--text-primary);
  font-family: inherit;
  font-size: var(--text-body);
  resize: vertical;
  transition: border-color 120ms ease;
}

.reweight-tab__reason-input::placeholder {
  color: var(--text-tertiary);
}

.reweight-tab__reason-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent);
}

.reweight-tab__category {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.reweight-tab__category-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.reweight-tab__category-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.reweight-tab__category-name {
  color: var(--text-secondary);
}

.reweight-tab__category-count {
  color: var(--text-tertiary);
  font-weight: 400;
}

.reweight-tab__cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.reweight-card {
  display: flex;
  gap: var(--space-lg);
  padding: var(--space-md);
  background: var(--bg-elevated);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  transition: border-color 120ms ease;
}

.reweight-card--changed {
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
}

.reweight-card__left {
  display: flex;
  gap: var(--space-md);
  min-width: 0;
  flex-shrink: 0;
  max-width: 280px;
}

.reweight-card__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.reweight-card__title {
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.reweight-card__meta {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.reweight-card__badges {
  display: flex;
  gap: var(--space-xs);
  margin-top: 2px;
}

.reweight-card__right {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  min-width: 0;
}

.reweight-card__complexity-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.reweight-card__original {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  white-space: nowrap;
}

.reweight-card__mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.reweight-card__complexity-row :deep(.base-input) {
  width: 100px;
}

.reweight-card__delta {
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: var(--text-body);
  white-space: nowrap;
}

.reweight-card__delta--up {
  color: var(--success);
}

.reweight-card__delta--down {
  color: var(--error);
}

.reweight-card__slider-row {
  display: flex;
  align-items: center;
}

.reweight-card__slider {
  flex: 1;
  min-width: 0;
  height: 4px;
  appearance: none;
  -webkit-appearance: none;
  background: var(--bg-overlay);
  border-radius: 2px;
  cursor: pointer;
}

.reweight-card__slider::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid var(--bg-base);
  cursor: pointer;
  transition: transform 120ms ease;
}

.reweight-card__slider::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}

.reweight-card__slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid var(--bg-base);
  cursor: pointer;
}

.reweight-card__source {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  font-style: italic;
}

.reweight-tab__footer {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--space-md);
  border-top: 1px solid var(--bg-overlay);
}

.confirm-modal {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.confirm-modal__summary {
  color: var(--text-secondary);
  margin: 0;
}

.confirm-modal__list {
  max-height: 320px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.confirm-modal__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-xs) var(--space-sm);
  background: var(--bg-surface);
  border-radius: var(--radius-btn);
  font-size: var(--text-body);
}

.confirm-modal__name {
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  flex: 1;
}

.confirm-modal__values {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  flex-shrink: 0;
}

.confirm-modal__values svg {
  color: var(--text-tertiary);
}

.confirm-modal__mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.confirm-modal__error {
  color: var(--error);
  font-size: var(--text-caption);
}

@media (max-width: 767px) {
  .reweight-card {
    flex-direction: column;
    gap: var(--space-md);
  }

  .reweight-card__left {
    max-width: unset;
  }

  .reweight-tab__loader {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
