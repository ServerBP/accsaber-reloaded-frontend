<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import DataTable from '@/components/common/DataTable.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import CountryFlag from '@/components/domain/CountryFlag.vue'
import { ApiError } from '@/api/client'
import { useCategoryStore } from '@/stores/categories'
import { useModifierStore } from '@/stores/modifiers'
import type { CurveResponse } from '@/types/api/categories'
import type { TableColumn } from '@/types/display'
import type { Difficulty } from '@/types/enums'
import type { BeatLeaderScore } from '@/utils/beatsaver'
import { calculateAp } from '@/utils/curveEval'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  blLeaderboardId: string | null
  ssLeaderboardId?: string | null
  originalComplexity: number | null
  maxScore: number
  categoryCode: string
  songHash?: string | null
  difficulty?: Difficulty | null
  characteristic?: string | null
  aiAvailable?: boolean
}>()

const categoryStore = useCategoryStore()
const modifierStore = useModifierStore()

interface NormalizedScore {
  id: string
  userId: string
  baseScore: number
  modifiedScore: number
  modifiers: string
  player: {
    id: string
    name: string
    avatar: string
    country: string
  }
}

const scores = ref<NormalizedScore[]>([])
const fetchedMaxScore = ref(0)
const curve = ref<CurveResponse | null>(null)
const loading = ref(false)
const error = ref('')
const blFailed = ref(false)
const ssFailed = ref(false)

const base = computed(() => props.originalComplexity ?? 0)
const previewComplexity = ref(base.value)
const sliderMin = computed(() => Math.max(0, base.value - 7))
const sliderMax = computed(() => base.value + 7)
const effectiveMaxScore = computed(() => (props.maxScore > 0 ? props.maxScore : fetchedMaxScore.value))

const modifierMultiplierByCode = computed(() => {
  const map = new Map<string, number>()
  for (const m of modifierStore.modifiers) map.set(m.code.toUpperCase(), m.multiplier)
  return map
})

function modifierMultiplier(modifiers: string): number {
  if (!modifiers) return 1
  let mult = 1
  for (const code of modifiers.split(/[,\s+]+/).filter(Boolean)) {
    const m = modifierMultiplierByCode.value.get(code.toUpperCase())
    if (m != null) mult *= m
  }
  return mult
}

function setPreviewComplexity(v: string | number) {
  const n = Number(v)
  previewComplexity.value = Number.isFinite(n) ? n : 0
}

const aiLoading = ref(false)
const aiError = ref('')
const aiNotice = ref('')

const canFetchAi = computed(() =>
  !!props.aiAvailable && !!props.songHash && !!props.difficulty && !!props.characteristic,
)

async function fetchAiComplexity() {
  if (!canFetchAi.value) return
  aiLoading.value = true
  aiError.value = ''
  aiNotice.value = ''
  try {
    const { getAiComplexity } = await import('@/api/ranking/maps')
    const res = await getAiComplexity({
      songHash: props.songHash!,
      difficulty: props.difficulty!,
      characteristic: props.characteristic!,
    })
    if (res.complexity == null) {
      aiNotice.value = 'BeatLeader has no AI accuracy for this map.'
    } else {
      previewComplexity.value = res.complexity
    }
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 400) {
        aiError.value = 'AI complexity is only available for ranked difficulties.'
      } else if (e.status === 404) {
        aiError.value = 'No matching ranked difficulty found.'
      } else {
        aiError.value = 'Failed to fetch AI complexity.'
      }
    } else {
      aiError.value = 'Failed to fetch AI complexity.'
    }
  } finally {
    aiLoading.value = false
  }
}

watch(
  [() => props.songHash, () => props.difficulty, () => props.characteristic, () => props.aiAvailable],
  () => {
    aiError.value = ''
    aiNotice.value = ''
  },
)

const columns: TableColumn[] = [
  { key: 'rank', label: '#', align: 'right', mono: true, width: '56px' },
  { key: 'player', label: 'Player' },
  { key: 'score', label: 'Score', align: 'right', mono: true },
  { key: 'accuracy', label: 'Accuracy', align: 'right', mono: true },
  { key: 'ap', label: 'AP (preview)', align: 'right', mono: true },
]

const rows = computed(() => {
  const c = curve.value
  const complexity = previewComplexity.value
  const max = effectiveMaxScore.value
  return [...scores.value]
    .sort((a, b) => b.modifiedScore - a.modifiedScore)
    .map((s, i) => {
      const accuracy = max > 0 ? (s.baseScore * modifierMultiplier(s.modifiers)) / max : 0
      const ap = c && max > 0 ? calculateAp(c, accuracy, complexity) : 0
      return {
        key: s.id,
        rank: i + 1,
        player: s.player,
        score: s.modifiedScore,
        accuracy,
        ap,
      }
    })
})

function cleanPlayerName(name: string): string {
  const stripped = name.replace(/<[^>]+>/g, '').trim()
  return stripped || name
}

function normalizeBl(s: BeatLeaderScore): NormalizedScore {
  return {
    id: `bl-${s.id}`,
    userId: s.player.id,
    baseScore: s.baseScore,
    modifiedScore: s.modifiedScore,
    modifiers: s.modifiers,
    player: {
      id: s.player.id,
      name: cleanPlayerName(s.player.name),
      avatar: s.player.avatar,
      country: s.player.country,
    },
  }
}

async function loadScores() {
  const hasBl = !!props.blLeaderboardId
  const hasSs = !!props.ssLeaderboardId
  if (!hasBl && !hasSs) {
    scores.value = []
    fetchedMaxScore.value = 0
    blFailed.value = false
    ssFailed.value = false
    return
  }
  loading.value = true
  error.value = ''
  blFailed.value = false
  ssFailed.value = false

  const { fetchBeatLeaderScores, fetchScoreSaberScores } = await import('@/utils/beatsaver')
  const blPromise = hasBl
    ? fetchBeatLeaderScores(props.blLeaderboardId!, 100).catch(() => null)
    : Promise.resolve(null)
  const ssPromise = hasSs
    ? fetchScoreSaberScores(props.ssLeaderboardId!, 100).catch(() => null)
    : Promise.resolve(null)

  try {
  const [blResult, ssResult] = await Promise.all([blPromise, ssPromise])

  if (hasBl && !blResult) blFailed.value = true
  if (hasSs && !ssResult) ssFailed.value = true

  const byUser = new Map<string, NormalizedScore>()
  if (blResult) {
    for (const s of blResult.scores) {
      const norm = normalizeBl(s)
      if (!norm.userId) continue
      const existing = byUser.get(norm.userId)
      if (!existing || norm.baseScore > existing.baseScore) {
        byUser.set(norm.userId, norm)
      }
    }
  }
  if (ssResult) {
    for (const s of ssResult.scores) {
      const info = s.leaderboardPlayerInfo
      if (!info?.id) continue
      const norm: NormalizedScore = {
        id: `ss-${s.id}`,
        userId: info.id,
        baseScore: s.baseScore,
        modifiedScore: s.modifiedScore,
        modifiers: s.modifiers,
        player: {
          id: info.id,
          name: cleanPlayerName(info.name),
          avatar: info.profilePicture,
          country: info.country,
        },
      }
      const existing = byUser.get(norm.userId)
      if (!existing || norm.baseScore > existing.baseScore) {
        byUser.set(norm.userId, norm)
      }
    }
  }

  scores.value = Array.from(byUser.values())
  fetchedMaxScore.value = blResult?.maxScore ?? ssResult?.maxScore ?? 0

  if (hasBl && hasSs && !blResult && !ssResult) {
    error.value = 'Failed to load scores from BeatLeader and ScoreSaber.'
  } else if (hasBl && !hasSs && !blResult) {
    error.value = 'Failed to load BeatLeader scores.'
  } else if (!hasBl && hasSs && !ssResult) {
    error.value = 'Failed to load ScoreSaber scores.'
  }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load scores'
    scores.value = []
    fetchedMaxScore.value = 0
  } finally {
    loading.value = false
  }
}

async function loadCurve() {
  const id = categoryStore.byCode.get(props.categoryCode)?.scoreCurve?.id
  if (!id) {
    curve.value = null
    return
  }
  try {
    const { getCurve } = await import('@/api/curves')
    curve.value = await getCurve(id)
  } catch {
    curve.value = null
  }
}

watch(
  [() => props.blLeaderboardId, () => props.ssLeaderboardId],
  loadScores,
  { immediate: true },
)
watch(() => props.categoryCode, loadCurve, { immediate: true })
watch(() => props.originalComplexity, (v) => { previewComplexity.value = v ?? 0 })
</script>

<template>
  <div class="lb-preview">
    <div class="lb-preview__controls">
      <label class="lb-preview__label">Preview Complexity</label>
      <div class="lb-preview__inputs">
        <BaseInput :model-value="previewComplexity" type="number" step="0.1" min="0"
          @update:model-value="setPreviewComplexity" />
        <input type="range" class="lb-preview__slider" :min="sliderMin" :max="sliderMax" step="0.1"
          :value="previewComplexity" @input="setPreviewComplexity(($event.target as HTMLInputElement).value)" />
        <BaseButton size="sm" @click="previewComplexity = base">Reset</BaseButton>
        <BaseButton v-if="canFetchAi" size="sm" :loading="aiLoading" @click="fetchAiComplexity">
          Get AI Complexity
        </BaseButton>
      </div>
      <p class="lb-preview__hint">
        Original: <span class="lb-preview__mono">{{ base.toFixed(2) }}</span>
        <span v-if="previewComplexity !== base"> · Delta:
          <span class="lb-preview__mono"
            :class="previewComplexity > base ? 'lb-preview__delta--up' : 'lb-preview__delta--down'">
            {{ (previewComplexity - base >= 0 ? '+' : '') + (previewComplexity - base).toFixed(2) }}
          </span>
        </span>
      </p>
      <p v-if="aiError" class="lb-preview__ai-error">{{ aiError }}</p>
      <p v-else-if="aiNotice" class="lb-preview__ai-notice">{{ aiNotice }}</p>
    </div>

    <EmptyState v-if="!blLeaderboardId && !ssLeaderboardId"
      message="No BeatLeader or ScoreSaber leaderboard linked to this difficulty." />
    <EmptyState v-else-if="error && !loading && scores.length === 0" :message="error" />
    <template v-else>
      <p v-if="!loading && (blFailed || ssFailed)" class="lb-preview__partial">
        {{ blFailed && ssFailed
          ? 'Failed to load scores from BeatLeader and ScoreSaber.'
          : blFailed
            ? 'BeatLeader scores failed to load - showing ScoreSaber only.'
            : 'ScoreSaber scores failed to load - showing BeatLeader only.' }}
      </p>
      <DataTable :columns="columns" :rows="rows" :loading="loading" row-key="key"
        empty-message="No scores found.">
        <template #cell-player="{ row }">
          <div class="lb-preview__player">
            <img :src="(row.player as NormalizedScore['player']).avatar" alt="" class="lb-preview__avatar"
              loading="lazy" decoding="async" />
            <span class="lb-preview__player-name">{{ (row.player as NormalizedScore['player']).name }}</span>
            <CountryFlag :country="(row.player as NormalizedScore['player']).country" />
          </div>
        </template>
        <template #cell-score="{ value }">{{ (value as number).toLocaleString('en-US') }}</template>
        <template #cell-accuracy="{ value }">{{ ((value as number) * 100).toFixed(2) }}%</template>
        <template #cell-ap="{ value }">{{ (value as number).toFixed(2) }}</template>
      </DataTable>
    </template>
  </div>
</template>

<style scoped>
.lb-preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.lb-preview__controls {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-md) var(--space-lg);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
}

.lb-preview__label {
  font-size: var(--text-caption);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
}

.lb-preview__inputs {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.lb-preview__inputs :deep(.base-input) {
  width: 120px;
  flex-shrink: 0;
}

.lb-preview__slider {
  flex: 1;
  min-width: 0;
  height: 4px;
  appearance: none;
  -webkit-appearance: none;
  background: var(--bg-overlay);
  border-radius: 2px;
  cursor: pointer;
}

.lb-preview__slider::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--page-accent, var(--accent));
  border: 2px solid var(--bg-base);
  cursor: pointer;
  transition: transform 120ms ease;
}

.lb-preview__slider::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}

.lb-preview__slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--page-accent, var(--accent));
  border: 2px solid var(--bg-base);
  cursor: pointer;
}

.lb-preview__hint {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.lb-preview__mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.lb-preview__delta--up {
  color: var(--success);
}

.lb-preview__delta--down {
  color: var(--error);
}

.lb-preview__ai-error {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--error);
}

.lb-preview__ai-notice {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.lb-preview__partial {
  margin: 0;
  padding: var(--space-xs) var(--space-sm);
  background: color-mix(in srgb, var(--warning) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--warning) 30%, transparent);
  border-radius: var(--radius-btn);
  color: var(--warning);
  font-size: var(--text-caption);
}

.lb-preview__player {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-width: 0;
}

.lb-preview__avatar {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-avatar);
  object-fit: cover;
  flex-shrink: 0;
}

.lb-preview__player-name {
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}
</style>
