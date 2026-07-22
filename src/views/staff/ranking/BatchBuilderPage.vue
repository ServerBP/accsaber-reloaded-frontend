<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import GlowImage from '@/components/common/GlowImage.vue'
import ComplexityBadge from '@/components/domain/ComplexityBadge.vue'
import DifficultyBadge from '@/components/domain/DifficultyBadge.vue'
import { usePageMeta } from '@/composables/usePageMeta'
import { useCategoryStore } from '@/stores/categories'
import type { BatchResponse } from '@/types/api/batches'
import type { MapDifficultyResponse } from '@/types/api/maps'
import type { CategoryInfo } from '@/types/display'
import { CATEGORY_ORDER } from '@/utils/constants'
import { truncate } from '@/utils/formatters'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const categoryStore = useCategoryStore()

const batchId = computed(() => (route.params.batchId as string) || null)
const isNew = computed(() => !batchId.value)

usePageMeta({ title: computed(() => isNew.value ? 'New Batch | Ranking' : 'Edit Batch | Ranking') })

const batch = ref<BatchResponse | null>(null)
const batchName = ref('')
const batchDescription = ref('')
const loading = ref(true)
const saving = ref(false)
const error = ref('')

const queueDifficulties = ref<MapDifficultyResponse[]>([])
const queueLoading = ref(true)

const batchDifficultyIds = ref<Set<string>>(new Set())

const isDraft = computed(() => !batch.value || batch.value.status === 'DRAFT')
const isReleaseReady = computed(() => batch.value?.status === 'RELEASE_READY')

const trimmedName = computed(() => batchName.value.trim())
const trimmedDescription = computed(() => batchDescription.value.trim())

const detailsDirty = computed(() => {
  if (!batch.value) return false
  return (
    trimmedName.value !== batch.value.name ||
    trimmedDescription.value !== (batch.value.description ?? '')
  )
})

const difficultiesDirty = computed(() => {
  if (!batch.value) return batchDifficultyIds.value.size > 0
  const current = batch.value.difficulties
  if (current.length !== batchDifficultyIds.value.size) return true
  return current.some((d) => !batchDifficultyIds.value.has(d.id))
})

const hasChanges = computed(() =>
  isNew.value || detailsDirty.value || (isDraft.value && difficultiesDirty.value)
)

const canSave = computed(() => !!trimmedName.value && hasChanges.value)


const activeCategories = computed<CategoryInfo[]>(() =>
  categoryStore.categoryInfoList
    .filter((c) => c.code !== 'xp' && c.code !== 'overall')
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.code as typeof CATEGORY_ORDER[number]) - CATEGORY_ORDER.indexOf(b.code as typeof CATEGORY_ORDER[number]))
)

const batchByCategory = computed(() => {
  const groups = new Map<string, MapDifficultyResponse[]>()
  for (const cat of activeCategories.value) {
    groups.set(cat.code, [])
  }

  for (const diff of queueDifficulties.value) {
    if (!batchDifficultyIds.value.has(diff.id)) continue
    const code = categoryStore.getCategoryCode(diff.categoryId) ?? 'overall'
    const key = groups.has(code) ? code : activeCategories.value[0]?.code ?? 'overall'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(diff)
  }

  if (batch.value) {
    for (const diff of batch.value.difficulties) {
      if (batchDifficultyIds.value.has(diff.id)) {
        const code = categoryStore.getCategoryCode(diff.categoryId) ?? 'overall'
        const key = groups.has(code) ? code : activeCategories.value[0]?.code ?? 'overall'
        if (!groups.has(key)) groups.set(key, [])
        const list = groups.get(key)!
        if (!list.find((d) => d.id === diff.id)) {
          list.push(diff)
        }
      }
    }
  }

  return groups
})

const availableQualified = computed(() =>
  queueDifficulties.value.filter((d) => !batchDifficultyIds.value.has(d.id) && d.status === 'QUALIFIED')
)

const availableQueued = computed(() =>
  queueDifficulties.value.filter((d) => !batchDifficultyIds.value.has(d.id) && d.status === 'QUEUE')
)

const totalSelected = computed(() => batchDifficultyIds.value.size)

async function fetchBatch() {
  if (!batchId.value) {
    loading.value = false
    return
  }
  loading.value = true
  try {
    const { getBatch } = await import('@/api/ranking/batches')
    const b = await getBatch(batchId.value)
    batch.value = b
    batchName.value = b.name
    batchDescription.value = b.description ?? ''
    batchDifficultyIds.value = new Set(b.difficulties.map((d) => d.id))
  } catch {
    error.value = 'Failed to load batch.'
  }
  loading.value = false
}

const diffBatchMap = ref<Map<string, string>>(new Map())

async function fetchQueue() {
  queueLoading.value = true
  try {
    const { getRankingDifficulties } = await import('@/api/ranking/maps')
    const [qualifiedRes, queueRes] = await Promise.all([
      getRankingDifficulties({ page: 0, size: 200, status: 'QUALIFIED', sort: 'createdAt,desc' } as never),
      getRankingDifficulties({ page: 0, size: 200, status: 'QUEUE', sort: 'createdAt,desc' } as never),
    ])
    queueDifficulties.value = [...qualifiedRes.content, ...queueRes.content]
  } catch {
    queueDifficulties.value = []
  }
  queueLoading.value = false
}

async function fetchOtherBatches() {
  try {
    const { listBatches } = await import('@/api/ranking/batches')
    const [draftRes, readyRes] = await Promise.all([
      listBatches({ status: 'DRAFT', page: 0, size: 100 }),
      listBatches({ status: 'RELEASE_READY', page: 0, size: 100 }),
    ])
    const map = new Map<string, string>()
    for (const b of [...draftRes.content, ...readyRes.content]) {
      if (b.id === batchId.value) continue
      for (const d of b.difficulties) {
        map.set(d.id, b.name)
      }
    }
    diffBatchMap.value = map
  } catch {
    diffBatchMap.value = new Map()
  }
}

watch(batchId, () => {
  fetchBatch()
  fetchQueue()
  fetchOtherBatches()
}, { immediate: true })

const pendingAdd = ref<string | null>(null)
const pendingAddWarning = ref('')

function requestAdd(diffId: string) {
  if (!isDraft.value) return

  const diff = queueDifficulties.value.find((d) => d.id === diffId)
  if (!diff) return

  const warnings: string[] = []

  if (diff.status === 'QUEUE') {
    warnings.push('This map is still in QUEUE and has not been qualified yet.')
  }

  if (diff.headCriteriaVote === 'DOWNVOTE') {
    warnings.push('Head ranker voted criteria fail on this map.')
  } else if (diff.criteriaDownvotes > diff.criteriaUpvotes) {
    warnings.push('Criteria votes are negative - may require a RANKING_HEAD override.')
  } else if (diff.criteriaUpvotes === 0 && diff.criteriaDownvotes === 0 && diff.criteriaStatus !== 'PASSED') {
    warnings.push('No criteria votes yet.')
  }

  const otherBatch = diffBatchMap.value.get(diffId)
  if (otherBatch) {
    warnings.push(`This map is already in batch "${otherBatch}".`)
  }

  if (warnings.length > 0) {
    pendingAdd.value = diffId
    pendingAddWarning.value = warnings.join(' ')
    return
  }

  addToBatch(diffId)
}

function confirmAdd() {
  if (pendingAdd.value) {
    addToBatch(pendingAdd.value)
    pendingAdd.value = null
    pendingAddWarning.value = ''
  }
}

function cancelAdd() {
  pendingAdd.value = null
  pendingAddWarning.value = ''
}

function addToBatch(diffId: string) {
  batchDifficultyIds.value = new Set([...batchDifficultyIds.value, diffId])
}

function removeFromBatch(diffId: string) {
  if (!isDraft.value) return
  const next = new Set(batchDifficultyIds.value)
  next.delete(diffId)
  batchDifficultyIds.value = next
}

async function saveBatch() {
  if (!canSave.value) return
  saving.value = true
  error.value = ''

  try {
    const api = await import('@/api/ranking/batches')
    let id = batchId.value

    if (!id) {
      const created = await api.createBatch({
        name: trimmedName.value,
        description: trimmedDescription.value,
      })
      id = created.id
      batch.value = created
      batchDescription.value = created.description ?? ''
      router.replace({ name: 'ranking-batch-builder', params: { batchId: id } })
    } else if (detailsDirty.value) {
      await api.updateBatch(id, {
        name: trimmedName.value,
        description: trimmedDescription.value || null,
      })
    }

    if (isDraft.value) {
      await syncDifficulties(id)
    }

    await fetchBatch()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to save batch.'
  } finally {
    saving.value = false
  }
}

async function syncDifficulties(id: string) {
  const { addDifficultyToBatch, removeDifficultyFromBatch } = await import('@/api/ranking/batches')

  const currentIds = new Set(batch.value?.difficulties.map((d) => d.id) ?? [])
  const targetIds = batchDifficultyIds.value

  const toRemove = [...currentIds].filter((diffId) => !targetIds.has(diffId))
  const toAdd = [...targetIds].filter((diffId) => !currentIds.has(diffId))

  for (const diffId of toRemove) {
    await removeDifficultyFromBatch(id, diffId)
  }
  for (const diffId of toAdd) {
    await addDifficultyToBatch(id, diffId)
  }
}

const showMarkReady = ref(false)
const markReadyLoading = ref(false)

async function handleMarkReady() {
  if (!batchId.value) return
  markReadyLoading.value = true
  try {
    const { updateBatchStatus } = await import('@/api/ranking/batches')
    await updateBatchStatus(batchId.value, { status: 'RELEASE_READY' })
    showMarkReady.value = false
    await fetchBatch()
  } catch {
  } finally {
    markReadyLoading.value = false
  }
}

const showRelease = ref(false)
const releaseLoading = ref(false)

async function handleRelease() {
  if (!batchId.value) return
  releaseLoading.value = true
  try {
    const { releaseBatch } = await import('@/api/ranking/batches')
    await releaseBatch(batchId.value)
    showRelease.value = false
    router.push({ name: 'staff-ranking-head' })
  } catch {
  } finally {
    releaseLoading.value = false
  }
}

function goBack() {
  router.push({ name: 'staff-ranking-head' })
}

function goToDetail(diffId: string) {
  router.push({ name: 'ranking-map-detail', params: { difficultyId: diffId } })
}

const editingComplexity = ref<string | null>(null)
const editComplexityValue = ref<number>(0)

function startEditComplexity(diff: MapDifficultyResponse) {
  editingComplexity.value = diff.id
  editComplexityValue.value = diff.complexity ?? 0
}

async function saveComplexity(diffId: string) {
  try {
    const { updateMapComplexity } = await import('@/api/ranking/maps')
    await updateMapComplexity(diffId, { complexity: editComplexityValue.value })
    editingComplexity.value = null
    await fetchQueue()
    await fetchBatch()
  } catch {
  }
}

function criteriaIndicatorClass(diff: MapDifficultyResponse): string {
  if (diff.headCriteriaVote === 'UPVOTE') return 'batch-builder__criteria--pass'
  if (diff.headCriteriaVote === 'DOWNVOTE') return 'batch-builder__criteria--fail'
  if (diff.criteriaUpvotes > diff.criteriaDownvotes) return 'batch-builder__criteria--pass'
  if (diff.criteriaDownvotes > diff.criteriaUpvotes) return 'batch-builder__criteria--fail'
  return 'batch-builder__criteria--pending'
}
</script>

<template>
  <div class="batch-builder">
    <div class="batch-builder__header">
      <button class="batch-builder__back" @click="goBack" aria-label="Back to batches">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <h1 class="batch-builder__title">{{ isNew ? 'New Batch' : (trimmedName || 'Untitled Batch') }}</h1>
      <div class="batch-builder__header-actions">
        <BaseButton size="sm" :loading="saving" :disabled="!canSave" @click="saveBatch">
          Save
        </BaseButton>
        <BaseButton v-if="isDraft && !isNew && totalSelected > 0" size="sm" variant="primary" @click="showMarkReady = true">
          Mark Ready
        </BaseButton>
        <BaseButton v-if="isReleaseReady" size="sm" variant="primary" @click="showRelease = true">
          Release
        </BaseButton>
      </div>
    </div>

    <div class="batch-builder__name-row">
      <BaseInput v-model="batchName" label="Name" placeholder="Batch name" />
      <BaseInput v-model="batchDescription" label="Description" placeholder="Description (optional)" />
    </div>
    <p v-if="!isDraft" class="batch-builder__name-hint">
      Maps are locked for this batch - only the name and description can be edited.
    </p>

    <div v-if="error" class="batch-builder__error">{{ error }}</div>

    <div class="batch-builder__quadrants" :style="{ '--cat-count': activeCategories.length }">
      <div
        v-for="cat in activeCategories"
        :key="cat.code"
        class="batch-builder__quadrant"
        :style="{ '--cat-accent': cat.accent }"
      >
        <div class="batch-builder__quadrant-header">
          <span class="batch-builder__quadrant-dot" :style="{ background: cat.accent }" />
          <span class="batch-builder__quadrant-name">{{ cat.name }}</span>
          <span class="batch-builder__quadrant-count">{{ batchByCategory.get(cat.code)?.length ?? 0 }}</span>
        </div>
        <div class="batch-builder__quadrant-cards">
          <div
            v-for="diff in batchByCategory.get(cat.code) ?? []"
            :key="diff.id"
            class="batch-builder__card batch-builder__card--selected"
          >
            <span class="batch-builder__criteria-indicator" :class="criteriaIndicatorClass(diff)">
              <svg v-if="diff.criteriaUpvotes > diff.criteriaDownvotes" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              <svg v-else-if="diff.criteriaDownvotes > diff.criteriaUpvotes" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              <svg v-else width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </span>
            <GlowImage :src="diff.cdnCoverUrl ?? diff.coverUrl" alt="" :size="36"
              class="batch-builder__card-cover" @click="goToDetail(diff.id)"
              :fallback-src="diff.cdnCoverUrl && diff.coverUrl && diff.cdnCoverUrl !== diff.coverUrl ? diff.coverUrl : null" />
            <div class="batch-builder__card-info" @click="goToDetail(diff.id)">
              <span class="batch-builder__card-title">{{ truncate(diff.songName, 22) }}</span>
              <span class="batch-builder__card-meta">
                <DifficultyBadge :difficulty="diff.difficulty" />
                <span class="batch-builder__card-author">{{ truncate(diff.songAuthor, 18) }}</span>
                <span v-if="diff.mapAuthor" class="batch-builder__card-mapper">· {{ truncate(diff.mapAuthor, 16) }}</span>
              </span>
            </div>
            <template v-if="editingComplexity === diff.id">
              <input
                v-model.number="editComplexityValue"
                type="number"
                step="0.1"
                class="batch-builder__complexity-input"
                @keydown.enter="saveComplexity(diff.id)"
                @keydown.escape="editingComplexity = null"
              />
              <button class="batch-builder__complexity-save" @click="saveComplexity(diff.id)" aria-label="Save">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
            </template>
            <template v-else>
              <span v-if="diff.complexity != null" class="batch-builder__complexity-value" @click="startEditComplexity(diff)">
                <ComplexityBadge :complexity="diff.complexity" />
              </span>
            </template>
            <button v-if="isDraft" class="batch-builder__card-action batch-builder__card-action--remove" @click.stop="removeFromBatch(diff.id)" aria-label="Remove from batch">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div v-if="(batchByCategory.get(cat.code)?.length ?? 0) === 0" class="batch-builder__quadrant-empty">
            No maps
          </div>
        </div>
      </div>
    </div>

    <template v-if="isDraft">
      <div v-if="queueLoading" class="batch-builder__queue-section">
        <div class="batch-builder__queue-loading">Loading maps...</div>
      </div>

      <div v-if="!queueLoading && availableQualified.length > 0" class="batch-builder__queue-section">
        <h2 class="batch-builder__queue-title">
          Qualified
          <span class="batch-builder__queue-count">{{ availableQualified.length }}</span>
        </h2>
        <div class="batch-builder__queue-grid">
          <div
            v-for="diff in availableQualified"
            :key="diff.id"
            class="batch-builder__card"
          >
            <span class="batch-builder__criteria-indicator" :class="criteriaIndicatorClass(diff)">
              <svg v-if="diff.criteriaUpvotes > diff.criteriaDownvotes" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              <svg v-else-if="diff.criteriaDownvotes > diff.criteriaUpvotes" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              <svg v-else width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </span>
            <GlowImage :src="diff.cdnCoverUrl ?? diff.coverUrl" alt="" :size="36"
              class="batch-builder__card-cover" @click="goToDetail(diff.id)"
              :fallback-src="diff.cdnCoverUrl && diff.coverUrl && diff.cdnCoverUrl !== diff.coverUrl ? diff.coverUrl : null" />
            <div class="batch-builder__card-info" @click="goToDetail(diff.id)">
              <span class="batch-builder__card-title">{{ truncate(diff.songName, 22) }}</span>
              <span class="batch-builder__card-meta">
                <DifficultyBadge :difficulty="diff.difficulty" />
                <span class="batch-builder__card-author">{{ truncate(diff.songAuthor, 18) }}</span>
                <span v-if="diff.mapAuthor" class="batch-builder__card-mapper">· {{ truncate(diff.mapAuthor, 16) }}</span>
              </span>
            </div>
            <span v-if="diffBatchMap.has(diff.id)" class="batch-builder__card-badge batch-builder__card-badge--batch">{{ diffBatchMap.get(diff.id) }}</span>
            <ComplexityBadge v-if="diff.complexity != null" :complexity="diff.complexity" />
            <button class="batch-builder__card-action batch-builder__card-action--add" @click.stop="requestAdd(diff.id)" aria-label="Add to batch">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div v-if="!queueLoading && availableQueued.length > 0" class="batch-builder__queue-section">
        <h2 class="batch-builder__queue-title">
          Queued
          <span class="batch-builder__queue-count">{{ availableQueued.length }}</span>
        </h2>
        <div class="batch-builder__queue-grid">
          <div
            v-for="diff in availableQueued"
            :key="diff.id"
            class="batch-builder__card"
          >
            <span class="batch-builder__criteria-indicator" :class="criteriaIndicatorClass(diff)">
              <svg v-if="diff.criteriaUpvotes > diff.criteriaDownvotes" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              <svg v-else-if="diff.criteriaDownvotes > diff.criteriaUpvotes" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              <svg v-else width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </span>
            <GlowImage :src="diff.cdnCoverUrl ?? diff.coverUrl" alt="" :size="36"
              class="batch-builder__card-cover" @click="goToDetail(diff.id)"
              :fallback-src="diff.cdnCoverUrl && diff.coverUrl && diff.cdnCoverUrl !== diff.coverUrl ? diff.coverUrl : null" />
            <div class="batch-builder__card-info" @click="goToDetail(diff.id)">
              <span class="batch-builder__card-title">{{ truncate(diff.songName, 22) }}</span>
              <span class="batch-builder__card-meta">
                <DifficultyBadge :difficulty="diff.difficulty" />
                <span class="batch-builder__card-author">{{ truncate(diff.songAuthor, 18) }}</span>
                <span v-if="diff.mapAuthor" class="batch-builder__card-mapper">· {{ truncate(diff.mapAuthor, 16) }}</span>
              </span>
            </div>
            <span v-if="diffBatchMap.has(diff.id)" class="batch-builder__card-badge batch-builder__card-badge--batch">{{ diffBatchMap.get(diff.id) }}</span>
            <ComplexityBadge v-if="diff.complexity != null" :complexity="diff.complexity" />
            <button class="batch-builder__card-action batch-builder__card-action--add" @click.stop="requestAdd(diff.id)" aria-label="Add to batch">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <EmptyState v-if="!queueLoading && availableQualified.length === 0 && availableQueued.length === 0" message="No maps available" />
    </template>

    <BaseModal :open="showMarkReady" title="Mark Ready" max-width="400px" @close="showMarkReady = false">
      <p style="color: var(--text-secondary); margin: 0">
        Mark this batch as release ready? Editing will be locked.
      </p>
      <template #footer>
        <div style="display: flex; gap: var(--space-sm); justify-content: flex-end">
          <BaseButton @click="showMarkReady = false">Cancel</BaseButton>
          <BaseButton variant="primary" :loading="markReadyLoading" @click="handleMarkReady">Confirm</BaseButton>
        </div>
      </template>
    </BaseModal>

    <BaseModal :open="showRelease" title="Release Batch" max-width="420px" @close="showRelease = false">
      <p style="color: var(--text-secondary); margin: 0">
        Release <strong>{{ batchName }}</strong> with {{ totalSelected }} difficulties?
        This will rank all maps in the batch and trigger score backfill. This action is irreversible.
      </p>
      <template #footer>
        <div style="display: flex; gap: var(--space-sm); justify-content: flex-end">
          <BaseButton @click="showRelease = false">Cancel</BaseButton>
          <BaseButton variant="destructive" :loading="releaseLoading" @click="handleRelease">Release</BaseButton>
        </div>
      </template>
    </BaseModal>

    <BaseModal :open="!!pendingAdd" title="Warning" max-width="420px" @close="cancelAdd">
      <p style="color: var(--warning); margin: 0">{{ pendingAddWarning }}</p>
      <p style="color: var(--text-secondary); margin: var(--space-sm) 0 0">Add to batch anyway?</p>
      <template #footer>
        <div style="display: flex; gap: var(--space-sm); justify-content: flex-end">
          <BaseButton @click="cancelAdd">Cancel</BaseButton>
          <BaseButton variant="primary" @click="confirmAdd">Add Anyway</BaseButton>
        </div>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.batch-builder {
  max-width: 1440px;
  margin: 0 auto;
  padding: var(--space-xl) var(--space-xl) var(--space-3xl);
}

.batch-builder__header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
}

.batch-builder__back {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: var(--space-xs);
  border-radius: var(--radius-btn);
  display: flex;
  align-items: center;
  transition: color 120ms ease, background 120ms ease;
}

.batch-builder__back:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

.batch-builder__title {
  font-size: var(--text-page-title);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  flex: 1;
}

.batch-builder__header-actions {
  display: flex;
  gap: var(--space-sm);
}

.batch-builder__name-row {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
}

.batch-builder__name-row > * {
  flex: 1;
}

.batch-builder__name-hint {
  margin: calc(-1 * var(--space-md)) 0 var(--space-lg);
  color: var(--text-tertiary);
  font-size: var(--text-caption);
}

.batch-builder__error {
  padding: var(--space-sm) var(--space-md);
  background: color-mix(in srgb, var(--error) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--error) 25%, transparent);
  border-radius: var(--radius-btn);
  color: var(--error);
  font-size: var(--text-caption);
  margin-bottom: var(--space-lg);
}

.batch-builder__quadrants {
  display: grid;
  grid-template-columns: repeat(var(--cat-count, 4), 1fr);
  gap: var(--space-md);
  margin-bottom: var(--space-xl);
}

.batch-builder__quadrant {
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  padding: var(--space-md);
  min-height: 200px;
  border-top: 2px solid var(--cat-accent, var(--accent));
}

.batch-builder__quadrant-header {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-bottom: var(--space-md);
}

.batch-builder__quadrant-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.batch-builder__quadrant-name {
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.batch-builder__quadrant-count {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  margin-left: auto;
}

.batch-builder__quadrant-cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.batch-builder__quadrant-empty {
  color: var(--text-tertiary);
  font-size: var(--text-caption);
  text-align: center;
  padding: var(--space-xl) 0;
}

.batch-builder__card {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-btn);
  background: var(--bg-elevated);
  border: 1px solid transparent;
  transition: border-color 120ms ease, background 120ms ease;
}

.batch-builder__criteria-indicator {
  position: absolute;
  top: -3px;
  left: -3px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

.batch-builder__criteria--pass {
  background: var(--success);
  color: var(--bg-base);
}

.batch-builder__criteria--fail {
  background: var(--error);
  color: var(--bg-base);
}

.batch-builder__criteria--pending {
  background: var(--text-tertiary);
  color: var(--bg-base);
}

.batch-builder__card-cover,
.batch-builder__card-info {
  cursor: pointer;
}

.batch-builder__card--selected {
  border-color: color-mix(in srgb, var(--cat-accent, var(--accent)) 30%, transparent);
}

.batch-builder__card-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.batch-builder__card-title {
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.batch-builder__card-meta {
  font-size: 0.65rem;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.batch-builder__card-badge {
  font-size: 0.6rem;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: var(--radius-pill);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  flex-shrink: 0;
}

.batch-builder__card-badge--batch {
  background: color-mix(in srgb, var(--info) 15%, transparent);
  color: var(--info);
  border: 1px solid color-mix(in srgb, var(--info) 30%, transparent);
}

.batch-builder__card-author,
.batch-builder__card-mapper {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.batch-builder__card-mapper {
  color: var(--text-tertiary);
}

.batch-builder__card-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-btn);
  border: 1px solid var(--bg-overlay);
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
}

.batch-builder__card-action--remove {
  color: var(--text-tertiary);
}

.batch-builder__card-action--remove:hover {
  color: var(--error);
  border-color: var(--error);
  background: color-mix(in srgb, var(--error) 10%, transparent);
}

.batch-builder__card-action--add {
  color: var(--text-tertiary);
}

.batch-builder__card-action--add:hover {
  color: var(--success);
  border-color: var(--success);
  background: color-mix(in srgb, var(--success) 10%, transparent);
}

.batch-builder__complexity-value {
  cursor: pointer;
}

.batch-builder__complexity-input {
  width: 64px;
  padding: 2px 6px;
  background: var(--bg-base);
  border: 1px solid var(--accent, var(--bg-overlay));
  border-radius: var(--radius-btn);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  text-align: center;
}

.batch-builder__complexity-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent);
}

.batch-builder__complexity-save {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--success);
  cursor: pointer;
  padding: 2px;
}

.batch-builder__queue-section {
  border-top: 1px solid var(--bg-overlay);
  padding-top: var(--space-xl);
}

.batch-builder__queue-title {
  font-size: var(--text-section);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 var(--space-md);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.batch-builder__queue-count {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  font-weight: 400;
}

.batch-builder__queue-loading {
  color: var(--text-secondary);
  font-size: var(--text-body);
  padding: var(--space-xl);
  text-align: center;
}

.batch-builder__queue-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-sm);
}

@media (max-width: 1023px) {
  .batch-builder__quadrants {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 767px) {
  .batch-builder {
    padding: var(--space-md) var(--space-md) var(--space-2xl);
  }

  .batch-builder__quadrants {
    grid-template-columns: 1fr;
  }

  .batch-builder__name-row {
    flex-direction: column;
  }

  .batch-builder__queue-grid {
    grid-template-columns: 1fr;
  }

  .batch-builder__card-action {
    width: 32px;
    height: 32px;
  }
}
</style>
