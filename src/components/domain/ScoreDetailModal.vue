<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import CategoryBadge from '@/components/domain/CategoryBadge.vue'
import ComplexityBadge from '@/components/domain/ComplexityBadge.vue'
import CountryFlag from '@/components/domain/CountryFlag.vue'
import DifficultyBadge from '@/components/domain/DifficultyBadge.vue'
import LevelBadge from '@/components/domain/LevelBadge.vue'
import SupporterTierIcon from '@/components/domain/SupporterTierIcon.vue'
import TimeSeriesChart from '@/components/domain/TimeSeriesChart.vue'
import { useColorExtract } from '@/composables/useColorExtract'
import { useSettingsStore } from '@/stores/settings'
import { useThemeStore } from '@/stores/theme'
import type {
  BorderColorValue,
  BorderShapeValue,
  EquippedItemsResponse,
  TitleValue,
} from '@/types/api/items'
import type {
  LevelResponse,
  ScoreResponse,
  UserResponse,
} from '@/types/api/users'
import type { PublicMapDifficultyResponse } from '@/types/api/maps'
import type { MetricType, ScoreDisplay, TimeRange, TimeSeriesPoint } from '@/types/display'
import { brightenRgb } from '@/utils/color'
import { SCORE_DETAIL_METRICS, TIME_RANGE_PARAMS } from '@/utils/constants'
import { formatRelativeDate } from '@/utils/formatters'
import {
  readBorderColorValue,
  readBorderShapeValue,
  readTitleValue,
} from '@/utils/items'
import { buildMapRoute } from '@/utils/mapRoute'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps<{
  open: boolean
  score: ScoreDisplay | null
  userId: string
}>()

const emit = defineEmits<{
  close: []
}>()

type ScoreMetric = 'accuracy' | 'ap' | 'xpCumulative' | 'xpPerAttempt'

const router = useRouter()
const themeStore = useThemeStore()
const settingsStore = useSettingsStore()
const beatLeaderFirst = computed(
  () => settingsStore.appearance['appearance.primaryReplayService'] !== 'arcviewer',
)
const coverUrl = computed(() => props.score?.coverUrl ?? '')
const { dominantColor } = useColorExtract(coverUrl)

const resolvedAccent = computed(() => {
  const raw = dominantColor.value
  if (!raw) return 'var(--accent)'
  return themeStore.theme === 'dark' ? brightenRgb(raw, 60) : raw
})

const historicData = ref<ScoreResponse[]>([])
const selectedMetric = ref<ScoreMetric>('accuracy')
const selectedRange = ref<TimeRange>('all')

const player = ref<UserResponse | null>(null)
const playerLevel = ref<LevelResponse | null>(null)
const equipped = ref<EquippedItemsResponse>({})
const mapDifficulty = ref<PublicMapDifficultyResponse | null>(null)

let lastFetchedUserId: string | null = null
let lastFetchedDifficultyId: string | null = null

const equippedTitle = computed<TitleValue | null>(() =>
  readTitleValue(equipped.value.title?.item.value),
)
const equippedBorderShape = computed<BorderShapeValue | null>(() =>
  readBorderShapeValue(equipped.value.profile_border_shape?.item.value),
)
const equippedBorderColor = computed<BorderColorValue | null>(() =>
  readBorderColorValue(equipped.value.profile_border_color?.item.value),
)

const playerName = computed(() => player.value?.name ?? props.score?.userName ?? '')
const playerCountry = computed(() => player.value?.country ?? '')
const playerAvatar = computed(() => player.value?.cdnAvatarUrl ?? player.value?.avatarUrl ?? '')
const playerAvatarFallback = computed(() => {
  const p = player.value
  if (!p) return null
  return p.cdnAvatarUrl && p.avatarUrl && p.cdnAvatarUrl !== p.avatarUrl ? p.avatarUrl : null
})
const handlePlayerAvatarError = (e: Event) => {
  const img = e.currentTarget as HTMLImageElement
  const fb = playerAvatarFallback.value
  if (fb && img.src !== fb && img.dataset.fellBack !== '1') {
    img.dataset.fellBack = '1'
    img.src = fb
  }
}
const handleScoreCoverError = (e: Event) => {
  const img = e.currentTarget as HTMLImageElement
  const fb = props.score?.coverFallbackUrl
  if (fb && img.src !== fb && img.dataset.fellBack !== '1') {
    img.dataset.fellBack = '1'
    img.src = fb
  }
}
const playerSupporterTier = computed(
  () => player.value?.supporterTier ?? props.score?.supporterTier ?? null,
)

const complexity = computed(() => mapDifficulty.value?.complexity ?? null)
const difficultyRaw = computed(() => mapDifficulty.value?.difficulty ?? null)
const characteristic = computed(() => mapDifficulty.value?.characteristic ?? null)
const songSubName = computed(() => mapDifficulty.value?.songSubName ?? null)

const isFc = computed(() => {
  const s = props.score
  if (!s) return false
  return (
    (s.misses ?? 0) === 0
    && (s.badCuts ?? 0) === 0
    && (s.wallHits ?? 0) === 0
    && (s.bombHits ?? 0) === 0
  )
})

const hasPrecisionFlaws = computed(() => {
  const s = props.score
  if (!s || isFc.value) return false
  return (s.misses ?? 0) > 0
    || (s.badCuts ?? 0) > 0
    || (s.wallHits ?? 0) > 0
    || (s.bombHits ?? 0) > 0
})

const detailParts = computed<string[]>(() => {
  const s = props.score
  if (!s) return []
  const out: string[] = []
  if (s.playCount != null) out.push(`${s.playCount} ${s.playCount === 1 ? 'play' : 'plays'}`)
  if (s.pauses != null) out.push(`${s.pauses} ${s.pauses === 1 ? 'pause' : 'pauses'}`)
  if (s.maxCombo != null) out.push(`${s.maxCombo.toLocaleString()} combo`)
  if (s.hmd) out.push(s.hmd)
  out.push(formatRelativeDate(s.date))
  return out
})

const showNoMods = computed(() => {
  const s = props.score
  if (!s || s.scoreNoMods == null) return false
  return s.scoreNoMods !== s.score
})

const totalMapXp = computed(() =>
  historicData.value.reduce((sum, s) => sum + (s.xpGained ?? 0), 0),
)
const totalBaseXp = computed(() =>
  historicData.value.reduce((sum, s) => sum + (s.baseXp ?? 0), 0),
)
const totalBonusXp = computed(() =>
  historicData.value.reduce((sum, s) => sum + (s.bonusXp ?? 0), 0),
)

function scoreTypeLabel(s: ScoreResponse): string {
  if (s.active) return 'Current PB'
  switch (s.supersedesReason) {
    case 'Score improved': return 'Previous PB'
    case 'Worse score': return 'Worse attempt'
    case 'Partial attempt': return 'Quit early'
    case 'Complexity reweight': return 'Reweighted'
    case 'XP curve update': return 'XP recomputed'
    case 'User merge': return 'Merged account'
    default: return s.partial ? 'Quit early' : 'Historical'
  }
}

function buildTooltipLines(s: ScoreResponse, prev: ScoreResponse | null): string[] {
  const lines: string[] = []
  lines.push(scoreTypeLabel(s))
  lines.push(`Accuracy: ${(s.accuracy * 100).toFixed(2)}%`)
  lines.push(`AP: ${s.ap.toFixed(2)}`)
  lines.push(`XP: ${(s.xpGained ?? 0).toFixed(1)} (${(s.baseXp ?? 0).toFixed(0)} base + ${(s.bonusXp ?? 0).toFixed(1)} bonus)`)
  if (s.streak115 != null) lines.push(`115 Streak: ${s.streak115}`)
  if (s.misses > 0) lines.push(`Misses: ${s.misses}`)
  if (s.rankWhenSet != null) lines.push(`Rank: #${s.rankWhenSet}`)
  if (prev) {
    const accDelta = (s.accuracy - prev.accuracy) * 100
    const apDelta = s.ap - prev.ap
    const parts: string[] = []
    if (accDelta !== 0) parts.push(`${accDelta > 0 ? '+' : ''}${accDelta.toFixed(2)}% acc`)
    if (apDelta !== 0) parts.push(`${apDelta > 0 ? '+' : ''}${apDelta.toFixed(2)} AP`)
    if (parts.length > 0) lines.push(`Δ ${parts.join(', ')}`)
  }
  return lines
}

const chartPoints = computed<TimeSeriesPoint[]>(() => {
  const sorted = [...historicData.value].sort(
    (a, b) => new Date(a.timeSet).getTime() - new Date(b.timeSet).getTime(),
  )

  if (selectedMetric.value === 'xpCumulative') {
    let cumulative = 0
    return sorted.map((s, i) => {
      cumulative += s.xpGained ?? 0
      return {
        timestamp: new Date(s.timeSet).getTime(),
        value: cumulative,
        tooltipLines: buildTooltipLines(s, i > 0 ? sorted[i - 1] : null),
      }
    })
  }

  if (selectedMetric.value === 'xpPerAttempt') {
    return sorted.map((s, i) => ({
      timestamp: new Date(s.timeSet).getTime(),
      value: s.xpGained ?? 0,
      tooltipLines: buildTooltipLines(s, i > 0 ? sorted[i - 1] : null),
    }))
  }

  return sorted.map((s, i) => ({
    timestamp: new Date(s.timeSet).getTime(),
    value: selectedMetric.value === 'accuracy' ? s.accuracy * 100 : s.ap,
    tooltipLines: buildTooltipLines(s, i > 0 ? sorted[i - 1] : null),
  }))
})

const chartFormatValue = computed(() => {
  if (selectedMetric.value === 'accuracy') return (v: number) => `${v.toFixed(2)}%`
  if (selectedMetric.value === 'xpCumulative' || selectedMetric.value === 'xpPerAttempt') return (v: number) => `${v.toFixed(1)} XP`
  return undefined
})

function navigateAway(to: Parameters<typeof router.push>[0]) {
  emit('close')
  requestAnimationFrame(() => router.push(to))
}

function goToProfile() {
  navigateAway({ name: 'player-profile', params: { userId: props.userId } })
}

function goToMap() {
  if (!props.score?.mapId) return
  navigateAway(buildMapRoute({
    beatsaverCode: props.score.beatsaverCode,
    mapId: props.score.mapId,
    difficulty: props.score.rawDifficulty,
    difficultyId: props.score.mapDifficultyId,
    characteristic: props.score.characteristic,
  }))
}

async function fetchHistoric() {
  if (!props.score) return
  try {
    const { getUserScoresHistoric } = await import('@/api/users')
    const params = TIME_RANGE_PARAMS[selectedRange.value]
    historicData.value = await getUserScoresHistoric(props.userId, {
      mapDifficultyId: props.score.mapDifficultyId,
      amount: params.amount,
      unit: params.unit,
    })
  } catch {
    historicData.value = []
  }
}

async function fetchPlayer() {
  if (!props.userId || props.userId === lastFetchedUserId) return
  lastFetchedUserId = props.userId
  try {
    const usersApi = await import('@/api/users')
    const itemsApi = await import('@/api/items')
    const [u, lvl, eq] = await Promise.all([
      usersApi.getUser(props.userId).catch(() => null),
      usersApi.getUserLevel(props.userId).catch(() => null),
      itemsApi.getUserEquippedItems(props.userId).catch(() => ({} as EquippedItemsResponse)),
    ])
    player.value = u
    playerLevel.value = lvl
    equipped.value = eq ?? {}
  } catch {
    player.value = null
    playerLevel.value = null
    equipped.value = {}
  }
}

async function fetchMapDifficulty() {
  const id = props.score?.mapDifficultyId
  if (!id || id === lastFetchedDifficultyId) return
  lastFetchedDifficultyId = id
  try {
    const { getDifficulty } = await import('@/api/maps')
    mapDifficulty.value = await getDifficulty(id)
  } catch {
    mapDifficulty.value = null
  }
}

watch(
  [() => props.open, () => props.score?.mapDifficultyId, selectedRange],
  ([open]) => {
    if (open && props.score) fetchHistoric()
  },
  { immediate: true },
)

watch(
  [() => props.open, () => props.userId],
  ([open]) => {
    if (open) fetchPlayer()
  },
  { immediate: true },
)

watch(
  [() => props.open, () => props.score?.mapDifficultyId],
  ([open]) => {
    if (open) fetchMapDifficulty()
  },
  { immediate: true },
)
</script>

<template>
  <BaseModal :open="open" max-width="980px" @close="emit('close')">
    <div v-if="score" class="score-detail" :style="{ '--detail-accent': resolvedAccent }">
      <button class="score-detail__close" aria-label="Close" @click="emit('close')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </button>


      <div class="score-detail__player">
        <LevelBadge
          v-if="playerAvatar"
          class="score-detail__levelbadge"
          :level="playerLevel?.level ?? 0"
          :current-xp="playerLevel?.xpForCurrentLevel ?? 0"
          :required-xp="playerLevel?.xpForNextLevel ?? 1"
          :avatar-url="playerAvatar"
          :fallback-title="playerLevel?.title"
          hide-progress
          :equipped-title="equippedTitle"
          :equipped-border-shape="equippedBorderShape"
          :equipped-border-color="equippedBorderColor"
        />
        <div v-else class="score-detail__player-skeleton" />

        <div class="score-detail__player-info">
          <div class="score-detail__player-name-row">
            <h2 class="score-detail__player-name">{{ playerName || '\u00A0' }}</h2>
            <SupporterTierIcon
              v-if="playerSupporterTier"
              :tier="playerSupporterTier"
              :size="16"
            />
            <CountryFlag v-if="playerCountry" :country="playerCountry" />
          </div>
        </div>

        <CategoryBadge class="score-detail__category" :category="score.categoryCode" size="md" />
      </div>

      <div class="score-detail__main">
        <div v-if="score.coverUrl" class="score-detail__cover-wrap">
          <img :src="score.coverUrl" :alt="score.mapName" class="score-detail__cover" decoding="async"
            @error="handleScoreCoverError" />
        </div>
        <div class="score-detail__map-info">
          <h3 class="score-detail__song">
            {{ score.mapName }}<span v-if="songSubName" class="score-detail__song-sub"> {{ songSubName }}</span>
          </h3>
          <p class="score-detail__credits">
            <span v-if="score.artistName">{{ score.artistName }}</span>
            <span v-if="score.mapAuthor" class="score-detail__credits-sep">·</span>
            <span v-if="score.mapAuthor" class="score-detail__credits-mapper">mapped by {{ score.mapAuthor }}</span>
          </p>
          <div class="score-detail__chips">
            <DifficultyBadge v-if="difficultyRaw" :difficulty="difficultyRaw" />
            <ComplexityBadge v-if="complexity != null" :complexity="complexity" />
            <span v-if="characteristic && characteristic !== 'Standard'" class="score-detail__char">
              {{ characteristic }}
            </span>
            <span v-if="isFc" class="score-detail__chip score-detail__chip--fc">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8L7 12L13 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              FC
              <span v-if="score.streak115" class="score-detail__chip-sub">{{ score.streak115 }}×115</span>
            </span>
            <span v-else-if="score.streak115 != null && score.streak115 > 0" class="score-detail__chip">
              {{ score.streak115 }}×115
            </span>
            <span v-for="mod in score.modifiers" :key="mod" class="score-detail__chip score-detail__chip--mod">
              {{ mod }}
            </span>
          </div>
        </div>
        <div class="score-detail__scores">
          <div class="score-detail__metric">
            <span class="score-detail__metric-value">{{ (score.accuracy * 100).toFixed(2) }}<span class="score-detail__metric-unit">%</span></span>
            <span class="score-detail__metric-label">accuracy</span>
          </div>
          <div class="score-detail__metric score-detail__metric--ap">
            <span class="score-detail__metric-value">{{ score.ap.toFixed(2) }}</span>
            <span class="score-detail__metric-label">
              AP<span v-if="score.weightedAp !== score.ap"> · weighted {{ score.weightedAp.toFixed(2) }}</span>
            </span>
          </div>
        </div>
      </div>

      <div class="score-detail__meta">
        <span class="score-detail__rank">#{{ score.leaderboardRank }}</span>
        <span v-if="score.rankWhenSet != null && score.rankWhenSet !== score.leaderboardRank"
          class="score-detail__rank-set">set as #{{ score.rankWhenSet }}</span>
        <span class="score-detail__meta-sep">·</span>
        <span class="score-detail__meta-value">{{ score.score.toLocaleString() }}<span class="score-detail__meta-label">score</span></span>
        <template v-if="showNoMods">
          <span class="score-detail__meta-sep">·</span>
          <span class="score-detail__meta-value">{{ score.scoreNoMods!.toLocaleString() }}<span class="score-detail__meta-label">no mods</span></span>
        </template>
        <template v-for="(part, idx) in detailParts" :key="idx">
          <span class="score-detail__meta-sep">·</span>
          <span class="score-detail__meta-text">{{ part }}</span>
        </template>
        <template v-if="hasPrecisionFlaws">
          <span class="score-detail__meta-sep">·</span>
          <span v-if="(score.misses ?? 0) > 0" class="score-detail__meta-bad">{{ score.misses }} {{ score.misses === 1 ? 'miss' : 'misses' }}</span>
          <span v-if="(score.badCuts ?? 0) > 0" class="score-detail__meta-bad">{{ score.badCuts }} bad</span>
          <span v-if="(score.wallHits ?? 0) > 0" class="score-detail__meta-bad">{{ score.wallHits }} {{ score.wallHits === 1 ? 'wall' : 'walls' }}</span>
          <span v-if="(score.bombHits ?? 0) > 0" class="score-detail__meta-bad">{{ score.bombHits }} {{ score.bombHits === 1 ? 'bomb' : 'bombs' }}</span>
        </template>
        <span v-if="totalMapXp > 0" class="score-detail__xp" tabindex="0" aria-label="XP breakdown">
          <span class="score-detail__xp-label">XP</span>
          <span class="score-detail__xp-value">{{ totalMapXp.toFixed(1) }}</span>
          <span class="score-detail__xp-breakdown">{{ totalBaseXp.toFixed(0) }}+<span class="score-detail__xp-bonus">{{ totalBonusXp.toFixed(1) }}</span></span>
          <svg class="score-detail__xp-help" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span class="score-detail__xp-tooltip" role="tooltip">
            <span class="score-detail__xp-tooltip-row">
              <span class="score-detail__xp-tooltip-key">Base</span>
              <span class="score-detail__xp-tooltip-val">{{ totalBaseXp.toFixed(1) }}</span>
            </span>
            <span class="score-detail__xp-tooltip-desc">Earned every attempt, scaled by accuracy.</span>
            <span class="score-detail__xp-tooltip-row">
              <span class="score-detail__xp-tooltip-key">Bonus</span>
              <span class="score-detail__xp-tooltip-val score-detail__xp-tooltip-val--bonus">{{ totalBonusXp.toFixed(1) }}</span>
            </span>
            <span class="score-detail__xp-tooltip-desc">Awarded once when you set a new PB.</span>
            <span class="score-detail__xp-tooltip-divider" />
            <span class="score-detail__xp-tooltip-row">
              <span class="score-detail__xp-tooltip-key score-detail__xp-tooltip-key--total">Total</span>
              <span class="score-detail__xp-tooltip-val score-detail__xp-tooltip-val--total">{{ totalMapXp.toFixed(1) }}</span>
            </span>
          </span>
        </span>
      </div>

      <div class="score-detail__links">
        <BaseButton size="sm" @click="goToProfile">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          Profile
        </BaseButton>
        <BaseButton v-if="score.mapId" size="sm" @click="goToMap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
          Map
        </BaseButton>
        <template v-if="score.blScoreId">
          <BaseButton v-if="beatLeaderFirst" size="sm"
            :href="`https://replay.beatleader.com/?scoreId=${score.blScoreId}`">
            <img src="https://beatleader.com/assets/bs-pepe.gif" alt="Replay" width="20" height="20"
              style="border-radius: 3px;" loading="lazy" decoding="async" />
            Replay
          </BaseButton>
          <BaseButton size="sm"
            :href="`https://allpoland.github.io/ArcViewer/?scoreID=${score.blScoreId}`">
            <img src="https://beatleader.com/assets/ArcViewerIcon.webp" alt="ArcViewer" width="20" height="20"
              style="border-radius: 3px;" loading="lazy" decoding="async" />
            ArcViewer
          </BaseButton>
          <BaseButton v-if="!beatLeaderFirst" size="sm"
            :href="`https://replay.beatleader.com/?scoreId=${score.blScoreId}`">
            <img src="https://beatleader.com/assets/bs-pepe.gif" alt="Replay" width="20" height="20"
              style="border-radius: 3px;" loading="lazy" decoding="async" />
            Replay
          </BaseButton>
          <BaseButton size="sm" :href="`https://beatleader.com/score/${score.blScoreId}`">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            BeatLeader
          </BaseButton>
        </template>
      </div>

      <div class="score-detail__history">
        <span class="score-detail__history-label">History</span>
        <TimeSeriesChart :data="chartPoints" :metric-label="selectedMetric" :accent-color="resolvedAccent"
          :available-metrics="SCORE_DETAIL_METRICS" :selected-metric="selectedMetric as MetricType"
          :selected-range="selectedRange" :format-value="chartFormatValue"
          @update:selected-metric="selectedMetric = $event as ScoreMetric"
          @update:selected-range="selectedRange = $event" />
      </div>
    </div>
  </BaseModal>
</template>

<style scoped>
.score-detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  position: relative;
  --accent: var(--detail-accent);
}

.score-detail__close {
  position: absolute;
  top: calc(-1 * var(--space-md));
  right: calc(-1 * var(--space-sm));
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-button);
  transition: color 120ms ease, background-color 120ms ease;
  z-index: 3;
}

.score-detail__close:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

.score-detail__player {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  position: relative;
  z-index: 1;
  min-height: 64px;
}

.score-detail__levelbadge {
  flex-shrink: 0;
}

.score-detail__levelbadge :deep(.level-badge) {
  flex-direction: row;
  align-items: center;
  gap: var(--space-sm);
}

.score-detail__levelbadge :deep(.level-badge__stack) {
  width: 64px;
  height: 64px;
}

.score-detail__levelbadge :deep(.level-badge__avatar-wrap) {
  width: 56px;
  height: 56px;
}

.score-detail__levelbadge :deep(.level-badge__below) {
  align-items: flex-start;
  width: auto;
  padding: 0;
  gap: 0;
}

.score-detail__levelbadge :deep(.level-badge__title-line) {
  white-space: normal;
  flex-wrap: wrap;
  font-size: var(--text-caption);
}

.score-detail__levelbadge :deep(.level-badge__level) {
  font-size: var(--text-caption);
}

.score-detail__player-skeleton {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-card);
  background: var(--bg-elevated);
  flex-shrink: 0;
}

.score-detail__player-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.score-detail__player-name-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-width: 0;
}

.score-detail__player-name {
  font-family: var(--font-sans);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.score-detail__player-name-row :deep(.country-flag) {
  font-size: 1.125rem;
}

.score-detail__category {
  flex-shrink: 0;
  margin-left: auto;
  padding-right: var(--space-xl);
}

.score-detail__main {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr) auto;
  gap: var(--space-lg);
  align-items: center;
  padding: var(--space-md) 0;
  border-top: 1px solid var(--bg-overlay);
  border-bottom: 1px solid var(--bg-overlay);
  position: relative;
  z-index: 1;
}

.score-detail__cover-wrap {
  position: relative;
  width: 112px;
  height: 112px;
  flex-shrink: 0;
}

.score-detail__cover {
  width: 112px;
  height: 112px;
  border-radius: var(--radius-card);
  object-fit: cover;
  border: 1px solid var(--bg-overlay);
}

.score-detail__map-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.score-detail__song {
  font-family: var(--font-sans);
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  letter-spacing: -0.005em;
}

.score-detail__song-sub {
  color: var(--text-secondary);
  font-weight: 400;
}

.score-detail__credits {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  margin: 0;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: baseline;
}

.score-detail__credits-sep {
  color: var(--text-tertiary);
}

.score-detail__credits-mapper {
  color: var(--text-tertiary);
}

.score-detail__chips {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
  flex-wrap: wrap;
  margin-top: 4px;
}

.score-detail__char {
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.score-detail__chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-secondary);
  padding: 2px 6px;
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-button);
  letter-spacing: 0.02em;
}

.score-detail__chip--fc {
  color: var(--success);
  border-color: color-mix(in srgb, var(--success) 50%, transparent);
  background: color-mix(in srgb, var(--success) 10%, transparent);
  font-family: var(--font-sans);
  font-weight: 700;
  letter-spacing: 0.08em;
}

.score-detail__chip-sub {
  color: color-mix(in srgb, var(--success) 80%, var(--text-primary));
  font-family: var(--font-mono);
  font-weight: 600;
  letter-spacing: 0;
}

.score-detail__chip--mod {
  color: var(--detail-accent);
  border-color: color-mix(in srgb, var(--detail-accent) 40%, transparent);
}

.score-detail__scores {
  display: flex;
  align-items: center;
  gap: var(--space-xl);
  padding-left: var(--space-lg);
  border-left: 1px solid var(--bg-overlay);
  align-self: stretch;
}

.score-detail__metric {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
  gap: 4px;
  justify-content: center;
}

.score-detail__metric-value {
  font-family: var(--font-mono);
  font-size: 2.5rem;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1;
  letter-spacing: -0.015em;
  font-variant-numeric: tabular-nums;
}

.score-detail__metric-unit {
  font-size: 1.5rem;
  color: var(--text-secondary);
  font-weight: 500;
  margin-left: 2px;
}

.score-detail__metric-label {
  font-size: 0.6875rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 600;
}

.score-detail__metric--ap .score-detail__metric-value {
  color: var(--detail-accent);
}

.score-detail__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-sm);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  position: relative;
  z-index: 1;
  padding-bottom: var(--space-sm);
}

.score-detail__rank {
  font-family: var(--font-mono);
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.score-detail__rank-set {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.score-detail__meta-sep {
  color: var(--text-tertiary);
}

.score-detail__meta-value {
  font-family: var(--font-mono);
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  font-size: var(--text-body);
}

.score-detail__meta-label {
  font-family: var(--font-sans);
  font-size: 0.625rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-left: 4px;
  font-weight: 600;
}

.score-detail__meta-text {
  color: var(--text-secondary);
}

.score-detail__meta-bad {
  color: var(--error);
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.score-detail__xp {
  position: relative;
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  margin-left: auto;
  padding: 2px 8px;
  background: color-mix(in srgb, var(--detail-accent) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--detail-accent) 30%, var(--bg-overlay));
  border-radius: var(--radius-button);
  cursor: help;
  outline: none;
}

.score-detail__xp:hover,
.score-detail__xp:focus-visible {
  border-color: color-mix(in srgb, var(--detail-accent) 55%, var(--bg-overlay));
}

.score-detail__xp-help {
  color: var(--text-tertiary);
  align-self: center;
  margin-left: 2px;
  transition: color 120ms ease;
}

.score-detail__xp:hover .score-detail__xp-help,
.score-detail__xp:focus-visible .score-detail__xp-help {
  color: var(--text-secondary);
}

.score-detail__xp-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  min-width: 240px;
  background: var(--bg-elevated);
  border: 1px solid var(--bg-overlay);
  border-radius: 6px;
  padding: var(--space-sm) var(--space-md);
  display: flex;
  flex-direction: column;
  gap: 4px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease, transform 120ms ease;
  transform: translateY(4px);
  z-index: 10;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
  text-align: left;
}

.score-detail__xp-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  right: 14px;
  border: 5px solid transparent;
  border-top-color: var(--bg-elevated);
}

.score-detail__xp:hover .score-detail__xp-tooltip,
.score-detail__xp:focus-visible .score-detail__xp-tooltip {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.score-detail__xp-tooltip-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-md);
}

.score-detail__xp-tooltip-key {
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 600;
}

.score-detail__xp-tooltip-key--total {
  color: var(--text-primary);
}

.score-detail__xp-tooltip-val {
  font-family: var(--font-mono);
  font-size: var(--text-body);
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.score-detail__xp-tooltip-val--bonus {
  color: var(--detail-accent);
}

.score-detail__xp-tooltip-val--total {
  font-weight: 700;
}

.score-detail__xp-tooltip-desc {
  font-size: 0.6875rem;
  color: var(--text-tertiary);
  line-height: 1.4;
  margin-bottom: 4px;
}

.score-detail__xp-tooltip-divider {
  height: 1px;
  background: var(--bg-overlay);
  margin: 2px 0;
}

.score-detail__xp-label {
  font-size: 0.625rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 600;
}

.score-detail__xp-value {
  font-family: var(--font-mono);
  font-size: var(--text-body);
  color: var(--text-primary);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.score-detail__xp-breakdown {
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  font-variant-numeric: tabular-nums;
}

.score-detail__xp-bonus {
  color: var(--detail-accent);
  font-weight: 600;
}

.score-detail__links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  position: relative;
  z-index: 1;
}

.score-detail__history {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding-top: var(--space-md);
  border-top: 1px solid var(--bg-overlay);
  position: relative;
  z-index: 1;
}

.score-detail__history :deep(.chart-canvas-wrapper) {
  height: 170px;
}

.score-detail__history :deep(.chart-skeleton) {
  height: 170px !important;
}

.score-detail__history-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

@media (max-width: 768px) {
  .score-detail__player {
    flex-wrap: wrap;
  }

  .score-detail__category {
    margin-left: 0;
    padding-right: 0;
  }

  .score-detail__main {
    grid-template-columns: 96px minmax(0, 1fr);
    grid-template-rows: auto auto;
    row-gap: var(--space-md);
  }

  .score-detail__cover-wrap,
  .score-detail__cover {
    width: 96px;
    height: 96px;
  }

  .score-detail__scores {
    grid-column: 1 / -1;
    border-left: none;
    border-top: 1px solid var(--bg-overlay);
    padding-left: 0;
    padding-top: var(--space-md);
    justify-content: space-between;
  }

  .score-detail__song {
    font-size: 1.125rem;
  }

  .score-detail__metric-value {
    font-size: 2rem;
  }

  .score-detail__xp {
    margin-left: 0;
  }
}
</style>
