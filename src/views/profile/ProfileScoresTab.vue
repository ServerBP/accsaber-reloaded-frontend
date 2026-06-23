<script setup lang="ts">
import GlowImage from '@/components/common/GlowImage.vue'
import ApTweaker from '@/components/domain/ApTweaker.vue'
import ScoreDetailModal from '@/components/domain/ScoreDetailModal.vue'
import ScoreTable from '@/components/domain/ScoreTable.vue'
import { usePageableRoute } from '@/composables/usePageableRoute'
import { useCategoryStore } from '@/stores/categories'
import { useModifierStore } from '@/stores/modifiers'
import { useSettingsStore } from '@/stores/settings'
import type { ScoreResponse } from '@/types/api/users'
import type { CategoryCode, ScoreDisplay, TableColumn } from '@/types/display'
import type { Page } from '@/types/pagination'
import { formatRelativeDate } from '@/utils/formatters'
import { toScoreDisplay } from '@/utils/mappers'
import { buildMapRoute } from '@/utils/mapRoute'
import { getRankClass } from '@/utils/ranking'
import { resolveReplay, type ResolvedReplay } from '@/utils/replay'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const props = withDefaults(defineProps<{
  userId: string
  category: CategoryCode
  search?: string
  isSelfProfile?: boolean
  pinnedScoreIds?: Set<string>
  canPinMore?: boolean
  pinPending?: Set<string>
}>(), {
  search: '',
  isSelfProfile: false,
  canPinMore: true,
})

const emit = defineEmits<{
  'pin-toggle': [scoreId: string]
}>()

const router = useRouter()
const categoryStore = useCategoryStore()
const modifierStore = useModifierStore()
const settingsStore = useSettingsStore()

const replayService = computed(() => settingsStore.appearance['appearance.primaryReplayService'])
function rowReplay(row: Record<string, unknown>): ResolvedReplay | null {
  return (row.replay as ResolvedReplay | null) ?? null
}

const { currentPage, sortState, paginationParams, setPage, setSort, resetPage } = usePageableRoute({
  defaultSort: 'weighted',
  defaultOrder: 'desc',
  defaultSize: 20,
  sortFieldMap: { leaderboardRank: 'rank', weighted: 'weightedAp', date: 'timeSet' },
})

const loading = ref(false)
const scoreData = ref<Page<ScoreResponse> | null>(null)

const detailOpen = ref(false)
const detailScore = ref<ScoreDisplay | null>(null)

const tweakerOpenId = ref<string | null>(null)
const tweakerAnchor = ref<HTMLElement | null>(null)

function toggleTweaker(diffId: string, event: Event) {
  event.preventDefault()
  event.stopPropagation()
  if (tweakerOpenId.value === diffId) {
    tweakerOpenId.value = null
    tweakerAnchor.value = null
  } else {
    tweakerOpenId.value = diffId
    tweakerAnchor.value = event.currentTarget as HTMLElement
  }
}

function getScoreCurveId(categoryCode: string): string | undefined {
  return categoryStore.byCode.get(categoryCode)?.scoreCurve?.id
}

function getSiblingAps(categoryCode: string): number[] {
  return scores.value
    .filter((s) => s.categoryCode === categoryCode)
    .map((s) => s.ap)
    .sort((a, b) => b - a)
}

const scores = computed<ScoreDisplay[]>(() => {
  if (!scoreData.value) return []
  return scoreData.value.content.map((s) => {
    const categoryCode = categoryStore.getCategoryCode(s.categoryId)
    return toScoreDisplay(
      s,
      modifierStore.resolveModifierCodes(s.modifierIds),
      categoryCode,
    )
  })
})

const rows = computed(() =>
  scores.value.map((s) => ({
    scoreId: s.scoreId,
    mapDifficultyId: s.mapDifficultyId,
    mapId: s.mapId,
    beatsaverCode: s.beatsaverCode ?? null,
    rawDifficulty: s.rawDifficulty,
    characteristic: s.characteristic,
    coverUrl: s.coverUrl,
    coverFallbackUrl: s.coverFallbackUrl,
    mapName: s.mapName,
    difficulty: s.difficulty,
    category: (categoryStore.getCategoryInfo(s.categoryCode)?.name ?? s.categoryCode).replace(/ Acc$/, ''),
    categoryCode: s.categoryCode,
    ap: s.ap,
    accuracy: s.accuracy,
    weighted: s.weightedAp,
    streak115: s.streak115,
    date: s.date,
    leaderboardRank: s.leaderboardRank,
    replay: resolveReplay(
      { blScoreId: s.blScoreId, ssScoreId: s.ssScoreId, date: s.date },
      replayService.value,
    ),
  })),
)

function isPinned(scoreId: string): boolean {
  return props.pinnedScoreIds?.has(scoreId) ?? false
}

function isPinPending(scoreId: string): boolean {
  return props.pinPending?.has(scoreId) ?? false
}

function pinDisabled(scoreId: string): boolean {
  return !isPinned(scoreId) && !props.canPinMore
}

function pinTitle(scoreId: string): string {
  if (isPinned(scoreId)) return 'Unpin score'
  if (pinDisabled(scoreId)) return 'Unpin a score to free a slot first'
  return 'Pin score'
}

function onPinClick(scoreId: string, event: Event) {
  event.preventDefault()
  event.stopPropagation()
  if (pinDisabled(scoreId) || isPinPending(scoreId)) return
  emit('pin-toggle', scoreId)
}

const totalPages = computed(() => scoreData.value?.totalPages ?? 0)

const accent = computed(() => categoryStore.getAccent(props.category))

const showStreak115 = computed(() =>
  sortState.value.key === 'streak115' || scores.value.some((s) => s.streak115 != null),
)

const allColumns: TableColumn[] = [
  { key: 'leaderboardRank', label: '#', sortable: true, align: 'right', mono: true, width: '50px' },
  { key: 'cover', label: '', width: '44px' },
  { key: 'mapName', label: 'Map', align: 'left' },
  { key: 'difficulty', label: 'Diff', align: 'center', width: '70px' },
  { key: 'accuracy', label: 'Acc', sortable: true, align: 'right', mono: true, width: '80px' },
  { key: 'ap', label: 'AP', sortable: true, align: 'right', mono: true, width: '100px' },
  { key: 'weighted', label: 'Weighted', sortable: true, align: 'right', mono: true, width: '80px' },
  { key: 'category', label: 'Category', align: 'center', width: '100px' },
  { key: 'streak115', label: '115s', sortable: true, align: 'right', mono: true, width: '60px' },
  { key: 'date', label: 'Date', sortable: true, align: 'right', width: '80px' },
  { key: 'actions', label: '', align: 'center', width: '108px', noLink: true },
]

const columns = computed(() =>
  showStreak115.value
    ? allColumns
    : allColumns.filter((c) => c.key !== 'streak115'),
)

async function fetchScores() {
  loading.value = true
  try {
    const { getUserScores } = await import('@/api/users')
    const categoryId = props.category !== 'overall'
      ? categoryStore.getCategoryId(props.category)
      : undefined

    const search = props.search.trim() || undefined
    const params = {
      ...paginationParams.value,
      categoryId,
      search,
    }

    scoreData.value = await getUserScores(props.userId, params)
  } catch {
    scoreData.value = null
  }
  loading.value = false
}

function scoreRowTo(row: Record<string, unknown>) {
  if (typeof row.mapId !== 'string') return undefined
  return buildMapRoute({
    beatsaverCode: typeof row.beatsaverCode === 'string' ? row.beatsaverCode : null,
    mapId: row.mapId,
    difficulty: typeof row.rawDifficulty === 'string' ? row.rawDifficulty : null,
    difficultyId: typeof row.mapDifficultyId === 'string' ? row.mapDifficultyId : null,
    characteristic: typeof row.characteristic === 'string' ? row.characteristic : null,
  })
}

function handleRowClick(row: Record<string, unknown>) {
  const to = scoreRowTo(row)
  if (to) router.push(to)
}

function openDetail(diffId: string, event: Event) {
  event.preventDefault()
  event.stopPropagation()
  detailScore.value = scores.value.find((s) => s.mapDifficultyId === diffId) ?? null
  detailOpen.value = true
}

watch(() => props.search, () => { resetPage() })

watch(
  [() => props.userId, () => props.category, paginationParams, () => props.search],
  () => { fetchScores() },
  { immediate: true },
)
</script>

<template>
  <div class="scores-tab">
    <ScoreTable :columns="columns" :rows="rows" :sort-state="sortState" :loading="loading" :loading-rows="8"
      :page="currentPage" :total-pages="totalPages" row-clickable :row-to="scoreRowTo" row-key="mapDifficultyId"
      medal-ranks
      :empty-message="props.search ? `No maps matching &quot;${props.search}&quot;` : 'No scores found'" @sort="setSort"
      @row-click="handleRowClick" @update:page="setPage">
      <template #cell-cover="{ row }">
        <GlowImage v-if="row.coverUrl" :src="(row.coverUrl as string)" :alt="(row.mapName as string)"
          :fallback-src="(row.coverFallbackUrl as string | null | undefined) ?? null" />
      </template>

      <template #cell-mapName="{ value }">
        <span class="scores-tab__map-name" :title="(value as string)">
          {{ (value as string).length > 24 ? (value as string).slice(0, 24) + '…' : value }}
        </span>
      </template>

      <template #cell-ap="{ row }">
        <span class="scores-tab__ap-cell" @click.stop.prevent>
          <span class="scores-tab__ap-value">{{ (row.ap as number).toFixed(2) }}</span>
          <button class="scores-tab__tweak-btn" aria-label="Tweak AP"
            @click.stop.prevent="toggleTweaker(row.mapDifficultyId as string, $event)">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" stroke="currentColor" stroke-width="1.5"
                stroke-linecap="round" stroke-linejoin="round" />
              <path
                d="M16.2 12.5a1.4 1.4 0 00.28 1.54l.05.05a1.7 1.7 0 11-2.4 2.4l-.05-.05a1.4 1.4 0 00-1.54-.28 1.4 1.4 0 00-.84 1.28v.14a1.7 1.7 0 11-3.4 0v-.07a1.4 1.4 0 00-.92-1.28 1.4 1.4 0 00-1.54.28l-.05.05a1.7 1.7 0 11-2.4-2.4l.05-.05a1.4 1.4 0 00.28-1.54 1.4 1.4 0 00-1.28-.84H2.3a1.7 1.7 0 110-3.4h.07a1.4 1.4 0 001.28-.92 1.4 1.4 0 00-.28-1.54l-.05-.05a1.7 1.7 0 112.4-2.4l.05.05a1.4 1.4 0 001.54.28h.07a1.4 1.4 0 00.84-1.28V2.3a1.7 1.7 0 113.4 0v.07a1.4 1.4 0 00.84 1.28 1.4 1.4 0 001.54-.28l.05-.05a1.7 1.7 0 112.4 2.4l-.05.05a1.4 1.4 0 00-.28 1.54v.07a1.4 1.4 0 001.28.84h.14a1.7 1.7 0 110 3.4h-.07a1.4 1.4 0 00-1.28.84z"
                stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <ApTweaker v-if="getScoreCurveId(row.categoryCode as string)" :open="tweakerOpenId === row.mapDifficultyId"
            :accuracy="(row.accuracy as number)" :ap="(row.ap as number)" :weighted-ap="(row.weighted as number)"
            :curve-id="getScoreCurveId(row.categoryCode as string)!" :anchor-el="tweakerAnchor"
            :sibling-aps="getSiblingAps(row.categoryCode as string)"
            @update:open="(val: boolean) => { tweakerOpenId = val ? (row.mapDifficultyId as string) : null; if (!val) tweakerAnchor = null }" />
        </span>
      </template>

      <template #cell-category="{ row }">
        <span class="scores-tab__category"
          :style="{ '--cat-accent': categoryStore.getAccent(row.categoryCode as string) }">
          {{ row.category }}
        </span>
      </template>

      <template #cell-difficulty="{ value }">
        <span class="scores-tab__difficulty">{{ value }}</span>
      </template>

      <template #cell-streak115="{ value }">
        <span v-if="value != null" class="scores-tab__streak">{{ value }}</span>
        <span v-else class="scores-tab__streak scores-tab__streak--empty">&ndash;</span>
      </template>

      <template #cell-actions="{ row }">
        <div class="scores-tab__actions">
          <button v-if="isSelfProfile" class="scores-tab__icon-btn"
            :class="{
              'scores-tab__icon-btn--active': isPinned(row.scoreId as string),
              'scores-tab__icon-btn--disabled': pinDisabled(row.scoreId as string),
            }"
            :aria-label="pinTitle(row.scoreId as string)" :title="pinTitle(row.scoreId as string)"
            :aria-pressed="isPinned(row.scoreId as string)"
            :disabled="isPinPending(row.scoreId as string)"
            @click="onPinClick(row.scoreId as string, $event)">
            <svg v-if="isPinned(row.scoreId as string)" width="14" height="14" viewBox="0 0 24 24"
              fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">
              <path d="M9 4h6l-1 5 4 3v3h-5v6l-1 1-1-1v-6H6v-3l4-3-1-5z" />
            </svg>
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 4h6l-1 5 4 3v3h-5v6l-1 1-1-1v-6H6v-3l4-3-1-5z" />
            </svg>
          </button>
          <a v-if="rowReplay(row)" class="scores-tab__icon-btn"
            :href="rowReplay(row)!.url" target="_blank" rel="noopener noreferrer"
            :aria-label="rowReplay(row)!.label" :title="rowReplay(row)!.label" @click.stop>
            <img :src="rowReplay(row)!.icon" alt="" width="14" height="14" style="border-radius: 2px;" loading="lazy" decoding="async" />
          </a>
          <button class="scores-tab__icon-btn" aria-label="View score details"
            @click="openDetail(row.mapDifficultyId as string, $event)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 11L5.5 5L8 8L10.5 4L14 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                stroke-linejoin="round" />
              <path d="M2 13H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </template>

      <template #mobile-card="{ row }">
        <div class="ps-card" @click="handleRowClick(row)">
          <GlowImage v-if="row.coverUrl" :src="(row.coverUrl as string)" :alt="(row.mapName as string)" :size="40"
            :fallback-src="(row.coverFallbackUrl as string | null | undefined) ?? null" />
          <div v-else class="ps-card__cover-placeholder" />
          <div class="ps-card__grid">
            <span class="ps-card__name-cell">
              <span class="ps-card__rank" :class="getRankClass(row.leaderboardRank as number)">#{{ row.leaderboardRank }}</span>
              <span class="ps-card__name" :title="(row.mapName as string)">{{ row.mapName }}</span>
              <span class="ps-card__diff">{{ row.difficulty }}</span>
            </span>
            <span class="ps-card__acc">{{ ((row.accuracy as number) * 100).toFixed(2) }}%</span>

            <span class="ps-card__meta-cell">
              <span class="ps-card__dot"
                :style="{ background: categoryStore.getAccent(row.categoryCode as string) }" />
              <span class="ps-card__category">{{ row.category }}</span>
              <span class="ps-card__sep">·</span>
              <span class="ps-card__date">{{ formatRelativeDate(row.date as string) }}</span>
            </span>
            <span class="ps-card__ap">{{ (row.ap as number).toFixed(2) }}</span>

            <span class="ps-card__streak-cell">
              <template v-if="(row.streak115 as number | null) != null">{{ row.streak115 }} 115s</template>
              <span v-else class="ps-card__sep">&ndash;</span>
            </span>
            <span class="ps-card__weighted">/ {{ (row.weighted as number).toFixed(2) }}</span>
          </div>
          <div class="ps-card__actions">
            <button v-if="isSelfProfile" class="ps-card__action-btn"
              :class="{
                'ps-card__action-btn--active': isPinned(row.scoreId as string),
                'ps-card__action-btn--disabled': pinDisabled(row.scoreId as string),
              }"
              :aria-label="pinTitle(row.scoreId as string)" :title="pinTitle(row.scoreId as string)"
              :aria-pressed="isPinned(row.scoreId as string)"
              :disabled="isPinPending(row.scoreId as string)"
              @click.stop="onPinClick(row.scoreId as string, $event)">
              <svg v-if="isPinned(row.scoreId as string)" width="14" height="14" viewBox="0 0 24 24"
                fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">
                <path d="M9 4h6l-1 5 4 3v3h-5v6l-1 1-1-1v-6H6v-3l4-3-1-5z" />
              </svg>
              <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 4h6l-1 5 4 3v3h-5v6l-1 1-1-1v-6H6v-3l4-3-1-5z" />
              </svg>
            </button>
            <a v-if="rowReplay(row)" class="ps-card__action-btn"
              :href="rowReplay(row)!.url" target="_blank" rel="noopener noreferrer"
              :aria-label="rowReplay(row)!.label" :title="rowReplay(row)!.label" @click.stop>
              <img :src="rowReplay(row)!.icon" alt="" width="14" height="14" style="border-radius: 2px;" loading="lazy" decoding="async" />
            </a>
            <button class="ps-card__action-btn" aria-label="View score details"
              @click.stop="openDetail(row.mapDifficultyId as string, $event)">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 11L5.5 5L8 8L10.5 4L14 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                  stroke-linejoin="round" />
                <path d="M2 13H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </template>
    </ScoreTable>

    <ScoreDetailModal :open="detailOpen" :score="detailScore" :user-id="userId" :accent-color="accent"
      @close="detailOpen = false" />
  </div>
</template>

<style scoped>
.scores-tab {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.scores-tab__category {
  color: color-mix(in srgb, var(--cat-accent) 30%, var(--text-secondary));
  font-size: var(--text-caption);
}

.scores-tab__map-name {
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scores-tab__difficulty {
  color: var(--text-secondary);
}

.scores-tab__streak--empty {
  color: var(--text-tertiary);
}

.scores-tab__ap-cell {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
}

.scores-tab__ap-value {
  font-weight: 500;
}

.scores-tab__tweak-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  border-radius: var(--radius-btn);
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: color 120ms ease;
}

.scores-tab__tweak-btn:hover {
  color: var(--accent, var(--text-primary));
}

.scores-tab__actions {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.scores-tab__icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-btn);
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  text-decoration: none;
  transition: color 120ms ease, border-color 120ms ease, background-color 120ms ease;
}

.scores-tab__icon-btn:hover:not(:disabled):not(.scores-tab__icon-btn--disabled) {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.scores-tab__icon-btn--active {
  color: var(--accent, var(--accent-overall));
  border-color: color-mix(in srgb, var(--accent, var(--accent-overall)) 50%, var(--bg-overlay));
  background: color-mix(in srgb, var(--accent, var(--accent-overall)) 10%, transparent);
}

.scores-tab__icon-btn--active:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent, var(--accent-overall)) 18%, transparent);
}

.scores-tab__icon-btn--disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.scores-tab__icon-btn:disabled {
  cursor: progress;
  opacity: 0.6;
}

.ps-card {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-left: 2px solid transparent;
  border-radius: var(--radius-card);
  cursor: pointer;
  min-height: 48px;
  transition: border-color 120ms ease;
}

.ps-card:hover {
  border-left-color: var(--accent, var(--text-tertiary));
}

.ps-card__cover-placeholder {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: var(--radius-avatar);
  background: var(--bg-overlay);
}

.ps-card__grid {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: var(--space-sm);
  row-gap: 2px;
  align-items: center;
}

.ps-card__name-cell,
.ps-card__meta-cell,
.ps-card__streak-cell {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ps-card__rank {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.ps-card__rank.rank--gold { color: var(--tier-gold); font-weight: 700; }
.ps-card__rank.rank--silver { color: var(--tier-silver); font-weight: 700; }
.ps-card__rank.rank--bronze { color: var(--tier-bronze); font-weight: 700; }

.ps-card__name {
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--text-body);
  min-width: 0;
}

.ps-card__diff {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  flex-shrink: 0;
}

.ps-card__meta-cell,
.ps-card__streak-cell {
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.ps-card__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ps-card__category {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.ps-card__sep {
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.ps-card__date {
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ps-card__acc {
  font-family: var(--font-mono);
  font-size: var(--text-body);
  color: var(--text-primary);
  justify-self: end;
  white-space: nowrap;
}

.ps-card__ap {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  font-weight: 500;
  justify-self: end;
  white-space: nowrap;
}

.ps-card__weighted {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  justify-self: end;
  white-space: nowrap;
}

.ps-card__actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
}

.ps-card__action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-btn);
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  text-decoration: none;
  transition: color 120ms ease, border-color 120ms ease, background-color 120ms ease;
}

.ps-card__action-btn:hover:not(:disabled):not(.ps-card__action-btn--disabled) {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.ps-card__action-btn--active {
  color: var(--accent, var(--accent-overall));
  border-color: color-mix(in srgb, var(--accent, var(--accent-overall)) 50%, var(--bg-overlay));
  background: color-mix(in srgb, var(--accent, var(--accent-overall)) 10%, transparent);
}

.ps-card__action-btn--disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.ps-card__action-btn:disabled {
  cursor: progress;
  opacity: 0.6;
}
</style>
