<script setup lang="ts">
import BaseSelect from '@/components/common/BaseSelect.vue'
import GlowImage from '@/components/common/GlowImage.vue'
import SearchBox from '@/components/common/SearchBox.vue'
import CountryFlag from '@/components/domain/CountryFlag.vue'
import PlayerTooltipTrigger from '@/components/domain/PlayerTooltipTrigger.vue'
import RelationFilter from '@/components/domain/RelationFilter.vue'
import ScoreDetailModal from '@/components/domain/ScoreDetailModal.vue'
import ScoreTable from '@/components/domain/ScoreTable.vue'
import SupporterTierIcon from '@/components/domain/SupporterTierIcon.vue'
import { usePageableRoute } from '@/composables/usePageableRoute'
import { useAuthStore } from '@/stores/auth'
import { useModifierStore } from '@/stores/modifiers'
import { useSettingsStore } from '@/stores/settings'
import type { UserRelationType } from '@/types/api/relations'
import type { SupporterTier } from '@/types/api/supporters'
import type { CategoryCode, DifficultyScoreDisplay, ScoreDisplay, TableColumn } from '@/types/display'
import { COUNTRY_OPTIONS } from '@/utils/countries'
import { formatRelativeDate } from '@/utils/formatters'
import { toDifficultyScoreDisplay } from '@/utils/mappers'
import { getRankClass } from '@/utils/ranking'
import { resolveReplay, type ResolvedReplay } from '@/utils/replay'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps<{
  difficultyId: string
  mapId?: string
  mapName?: string
  artistName?: string
  coverUrl?: string
  coverFallbackUrl?: string | null
  categoryCode?: CategoryCode
  difficulty?: string
  accentColor?: string
  mapAuthor?: string
}>()

const emit = defineEmits<{
  'top-scores-loaded': [scores: DifficultyScoreDisplay[]]
}>()

const router = useRouter()
const authStore = useAuthStore()
const modifierStore = useModifierStore()
const settingsStore = useSettingsStore()

const replayService = computed(() => settingsStore.appearance['appearance.primaryReplayService'])
function rowReplay(row: Record<string, unknown>): ResolvedReplay | null {
  return (row.replay as ResolvedReplay | null) ?? null
}

const { currentPage, sortState, paginationParams, setPage, setSort, resetPage } = usePageableRoute({
  defaultSort: 'ap',
  defaultOrder: 'desc',
  defaultSize: 50,
  sortFieldMap: {
    weighted: 'weightedAp',
    date: 'timeSet',
  },
})

const searchQuery = ref('')
const countryFilter = ref('')
const relationFilter = ref<UserRelationType | ''>('')

const scores = ref<DifficultyScoreDisplay[]>([])
const totalPages = ref(0)
const loading = ref(true)

const detailOpen = ref(false)
const detailScore = ref<ScoreDisplay | null>(null)
const detailUserId = ref('')

const showStreak115 = computed(() =>
  sortState.value.key === 'streak115' || scores.value.some((s) => s.streak115 != null && s.streak115 > 0),
)

const allColumns: TableColumn[] = [
  { key: 'rank', label: '#', sortable: true, align: 'right', mono: true, width: '80px' },
  { key: 'player', label: 'Player', align: 'left' },
  { key: 'accuracy', label: 'Acc', sortable: true, align: 'right', mono: true, width: '80px' },
  { key: 'score', label: 'Score', sortable: true, align: 'right', mono: true, width: '80px' },
  { key: 'ap', label: 'AP', sortable: true, align: 'right', mono: true, width: '80px' },
  { key: 'weighted', label: 'Weighted', sortable: true, align: 'right', mono: true, width: '80px' },
  { key: 'streak115', label: '115s', sortable: true, align: 'right', mono: true, width: '60px' },
  { key: 'date', label: 'Date', sortable: true, align: 'right', width: '80px' },
  { key: 'detail', label: '', align: 'center', width: '76px', noLink: true },
]

const columns = computed(() =>
  showStreak115.value
    ? allColumns
    : allColumns.filter((c) => c.key !== 'streak115'),
)

const rows = computed(() => {
  const pageOffset = (paginationParams.value.page ?? 0) * (paginationParams.value.size ?? 50)
  const filtering = !!countryFilter.value || !!relationFilter.value
  return scores.value.map((s, i) => {
    const positional = pageOffset + i + 1
    return {
      _userId: s.userId,
      rank: filtering ? positional : s.rank,
      parenRank: filtering ? s.rank : null,
      avatarUrl: s.avatarUrl,
      avatarFallbackUrl: s.avatarFallbackUrl,
      userName: s.userName,
      country: s.country,
      supporterTier: s.supporterTier,
      accuracy: s.accuracy,
      score: s.score,
      ap: s.ap,
      weighted: s.weightedAp,
      streak115: s.streak115,
      date: s.date,
      replay: resolveReplay(
        { blScoreId: s.blScoreId, ssScoreId: s.ssScoreId, date: s.date },
        replayService.value,
      ),
    }
  })
})

const countryOptions = computed(() => {
  const userCountry = authStore.userProfile?.country
  if (!userCountry) return COUNTRY_OPTIONS
  const userOption = COUNTRY_OPTIONS.find((o) => o.value === userCountry)
  if (!userOption) return COUNTRY_OPTIONS
  return [
    { value: '', label: 'All Countries' },
    userOption,
    ...COUNTRY_OPTIONS.filter((o) => o.value !== '' && o.value !== userCountry),
  ]
})

function scoreRowClass(row: Record<string, unknown>): Record<string, boolean> | undefined {
  if (!authStore.userId) return undefined
  return { 'data-table__row--self-highlight': row._userId === authStore.userId }
}

function playerRowTo(row: Record<string, unknown>) {
  return { name: 'player-profile', params: { userId: row._userId as string } }
}

function handleRowClick(row: Record<string, unknown>) {
  router.push(playerRowTo(row))
}

function openDetail(userId: string, event: Event) {
  event.preventDefault()
  event.stopPropagation()
  const s = scores.value.find((sc) => sc.userId === userId)
  if (!s) return
  detailUserId.value = s.userId
  detailScore.value = {
    mapId: props.mapId,
    mapDifficultyId: props.difficultyId,
    mapName: props.mapName ?? 'Unknown Map',
    artistName: props.artistName,
    difficulty: props.difficulty ?? '',
    categoryCode: props.categoryCode ?? 'overall',
    coverUrl: props.coverUrl,
    coverFallbackUrl: props.coverFallbackUrl,
    leaderboardRank: s.rank,
    score: s.score,
    scoreNoMods: s.scoreNoMods,
    accuracy: s.accuracy,
    ap: s.ap,
    weightedAp: s.weightedAp,
    modifiers: s.modifiers,
    date: s.date,
    misses: s.misses,
    badCuts: s.badCuts,
    maxCombo: s.maxCombo,
    wallHits: s.wallHits,
    bombHits: s.bombHits,
    pauses: s.pauses,
    streak115: s.streak115,
    playCount: s.playCount,
    hmd: s.hmd,
    xpGained: s.xpGained,
    rankWhenSet: s.rankWhenSet,
    blScoreId: s.blScoreId,
    ssScoreId: s.ssScoreId,
    mapAuthor: props.mapAuthor,
    userName: s.userName,
  }
  detailOpen.value = true
}

async function fetchScores() {
  loading.value = true
  try {
    const { getDifficultyScores } = await import('@/api/maps')
    const params = {
      ...paginationParams.value,
      search: searchQuery.value.trim() || undefined,
      country: countryFilter.value || undefined,
      relation: relationFilter.value || undefined,
    }
    const res = await getDifficultyScores(props.difficultyId, params)
    scores.value = res.content.map((s) =>
      toDifficultyScoreDisplay(s, modifierStore.resolveModifierCodes(s.modifierIds))
    )
    totalPages.value = res.totalPages

    const isCanonicalView =
      currentPage.value === 1 &&
      sortState.value.key === 'ap' &&
      sortState.value.direction === 'desc' &&
      !searchQuery.value.trim() &&
      !countryFilter.value &&
      !relationFilter.value
    if (isCanonicalView) {
      emit('top-scores-loaded', scores.value)
    }
  } catch {
    scores.value = []
    totalPages.value = 0
  }
  loading.value = false
}

watch(searchQuery, () => { resetPage() })
watch(countryFilter, () => { resetPage() })
watch(relationFilter, () => { resetPage() })

watch(
  [() => props.difficultyId, paginationParams, searchQuery, countryFilter, relationFilter],
  () => fetchScores(),
  { immediate: true, deep: true },
)
</script>

<template>
  <div class="map-scores">
    <div class="map-scores__controls">
      <BaseSelect :model-value="countryFilter" :options="countryOptions" placeholder="All Countries" searchable
        @update:model-value="countryFilter = $event" />
      <RelationFilter v-model="relationFilter" />
      <SearchBox v-model="searchQuery" placeholder="Search players..." />
    </div>

    <ScoreTable :columns="columns" :rows="rows" :sort-state="sortState" :loading="loading" :loading-rows="10"
      :page="currentPage" :total-pages="totalPages" medal-ranks row-clickable :row-to="playerRowTo"
      row-key="_userId" :row-class="scoreRowClass" empty-message="No scores recorded yet." @sort="setSort"
      @row-click="handleRowClick" @update:page="setPage">
      <template #cell-rank="{ value, row }">
        <span class="map-scores__rank" :class="getRankClass(value as number)">
          #{{ value }}
          <span v-if="row.parenRank" class="map-scores__rank-global">(#{{ row.parenRank }})</span>
        </span>
      </template>

      <template #cell-player="{ row }">
        <div class="map-scores__player">
          <PlayerTooltipTrigger :user-id="(row._userId as string)" :user-name="(row.userName as string)"
            :avatar-url="(row.avatarUrl as string)"
            :avatar-fallback-url="(row.avatarFallbackUrl as string | null | undefined) ?? null"
            :country="(row.country as string)">
            <GlowImage :src="(row.avatarUrl as string)" :alt="(row.userName as string)"
              :fallback-src="(row.avatarFallbackUrl as string | null | undefined) ?? null" />
            <span class="map-scores__name" :title="(row.userName as string)">{{ (row.userName as string).length > 18 ? (row.userName as string).slice(0, 18) + '…' : row.userName }}</span>
            <CountryFlag :country="(row.country as string)" />
            <SupporterTierIcon v-if="row.supporterTier" :tier="(row.supporterTier as SupporterTier)" />
          </PlayerTooltipTrigger>
        </div>
      </template>

      <template #cell-streak115="{ value }">
        <span v-if="value != null && value !== 0">{{ value }}</span>
        <span v-else class="map-scores__muted">&ndash;</span>
      </template>

      <template #cell-detail="{ row }">
        <div class="map-scores__actions">
          <a v-if="rowReplay(row)" class="map-scores__detail-btn"
            :href="rowReplay(row)!.url" target="_blank" rel="noopener noreferrer"
            :aria-label="rowReplay(row)!.label" :title="rowReplay(row)!.label" @click.stop>
            <img :src="rowReplay(row)!.icon" alt="" width="14" height="14" style="border-radius: 2px;" loading="lazy" decoding="async" />
          </a>
          <button class="map-scores__detail-btn" aria-label="View score details"
            @click="openDetail(row._userId as string, $event)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 11L5.5 5L8 8L10.5 4L14 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                stroke-linejoin="round" />
              <path d="M2 13H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </template>

      <template #mobile-card="{ row }">
        <router-link :to="playerRowTo(row)" class="ms-card"
          :class="{ 'ms-card--self-highlight': !!authStore.userId && row._userId === authStore.userId }">
          <GlowImage :src="(row.avatarUrl as string)" :alt="(row.userName as string)" :size="28"
            :fallback-src="(row.avatarFallbackUrl as string | null | undefined) ?? null" />
          <div class="ms-card__grid">
            <span class="ms-card__name-cell">
              <span class="ms-card__rank map-scores__rank" :class="getRankClass(row.rank as number)">
                #{{ row.rank }}<span v-if="row.parenRank" class="map-scores__rank-global">(#{{ row.parenRank }})</span>
              </span>
              <span class="ms-card__name" :title="(row.userName as string)">{{ (row.userName as string).length > 18 ? (row.userName as string).slice(0, 18) + '…' : row.userName }}</span>
              <CountryFlag :country="(row.country as string)" />
              <SupporterTierIcon v-if="row.supporterTier" :tier="(row.supporterTier as SupporterTier)" />
            </span>
            <span class="ms-card__acc">{{ ((row.accuracy as number) * 100).toFixed(2) }}%</span>

            <span class="ms-card__date">{{ formatRelativeDate(row.date as string) }}</span>
            <span class="ms-card__ap">{{ (row.ap as number).toFixed(2) }}</span>

            <span class="ms-card__streak-cell">
              <template v-if="(row.streak115 as number | null) != null && (row.streak115 as number) > 0">{{ row.streak115 }} 115s</template>
              <span v-else class="ms-card__sep">&ndash;</span>
            </span>
            <span class="ms-card__weighted">/ {{ (row.weighted as number).toFixed(2) }}</span>
          </div>
          <a v-if="rowReplay(row)" class="ms-card__detail-btn"
            :href="rowReplay(row)!.url" target="_blank" rel="noopener noreferrer"
            :aria-label="rowReplay(row)!.label" :title="rowReplay(row)!.label" @click.stop>
            <img :src="rowReplay(row)!.icon" alt="" width="14" height="14" style="border-radius: 2px;" loading="lazy" decoding="async" />
          </a>
          <button class="ms-card__detail-btn" aria-label="View score details"
            @click.stop="openDetail(row._userId as string, $event)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 11L5.5 5L8 8L10.5 4L14 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                stroke-linejoin="round" />
              <path d="M2 13H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </button>
        </router-link>
      </template>
    </ScoreTable>

    <ScoreDetailModal :open="detailOpen" :score="detailScore" :user-id="detailUserId" :accent-color="accentColor"
      @close="detailOpen = false" />
  </div>
</template>

<style scoped>
.map-scores {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.map-scores__controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}

.map-scores__rank {
  font-family: var(--font-mono);
  font-weight: 500;
  color: var(--text-secondary);
}

.map-scores__rank.rank--gold { color: var(--tier-gold); font-weight: 700; }
.map-scores__rank.rank--silver { color: var(--tier-silver); font-weight: 700; }
.map-scores__rank.rank--bronze { color: var(--tier-bronze); font-weight: 700; }

.map-scores__rank-global {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  font-weight: 400;
  margin-left: 2px;
}

.map-scores__player {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-width: 0;
}

.map-scores__name {
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-scores__muted {
  color: var(--text-tertiary);
}

.map-scores__actions {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
}

.map-scores__detail-btn {
  position: relative;
  z-index: 1;
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
  transition: color 120ms ease, border-color 120ms ease;
}

.map-scores__detail-btn:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

:deep(.data-table__row--self-highlight) {
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-surface));
  border-left: 2px solid color-mix(in srgb, var(--accent) 40%, transparent);
}

.ms-card {
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
  text-decoration: none;
  color: inherit;
}

.ms-card:hover {
  border-left-color: var(--accent, var(--text-tertiary));
}

.ms-card__rank {
  flex-shrink: 0;
}

.ms-card__grid {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: var(--space-sm);
  row-gap: 2px;
  align-items: center;
}

.ms-card__name-cell,
.ms-card__streak-cell {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ms-card__name {
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.ms-card__streak-cell {
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.ms-card__sep {
  color: var(--text-tertiary);
}

.ms-card__date {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ms-card__acc {
  font-family: var(--font-mono);
  font-size: var(--text-body);
  color: var(--text-primary);
  justify-self: end;
  white-space: nowrap;
}

.ms-card__ap {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  font-weight: 500;
  justify-self: end;
  white-space: nowrap;
}

.ms-card__weighted {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  justify-self: end;
  white-space: nowrap;
}

.ms-card__detail-btn {
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
  flex-shrink: 0;
  text-decoration: none;
  transition: color 120ms ease, border-color 120ms ease;
}

.ms-card__detail-btn:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.ms-card--self-highlight {
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-surface));
  border-left-color: color-mix(in srgb, var(--accent) 40%, transparent);
}
</style>
