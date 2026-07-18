<script setup lang="ts">
import { getLeaderboard } from '@/api/leaderboards'
import { getRelationScores } from '@/api/relations'
import BaseTabs from '@/components/common/BaseTabs.vue'
import DataTable from '@/components/common/DataTable.vue'
import FilterButton from '@/components/common/FilterButton.vue'
import FilterPopover from '@/components/common/FilterPopover.vue'
import GlowImage from '@/components/common/GlowImage.vue'
import PaginationControls from '@/components/common/PaginationControls.vue'
import CountryFlag from '@/components/domain/CountryFlag.vue'
import PlayerTooltipTrigger from '@/components/domain/PlayerTooltipTrigger.vue'
import ScoreDetailModal from '@/components/domain/ScoreDetailModal.vue'
import ScoreFeedCard from '@/components/domain/ScoreFeedCard.vue'
import { useAuthStore } from '@/stores/auth'
import { useCategoryStore } from '@/stores/categories'
import { useModifierStore } from '@/stores/modifiers'
import type { ScoreRelationType } from '@/types/api/relations'
import type { LeaderboardResponse, ScoreResponse } from '@/types/api/users'
import type { ScoreDisplay, ScoreFeedEntry, SortDirection, Tab, TableColumn } from '@/types/display'
import type { Page } from '@/types/pagination'
import { formatDifficulty, toPlayerDisplay } from '@/utils/mappers'
import { getRankClass } from '@/utils/ranking'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

type ScoreSortField = 'timeSet' | 'ap' | 'accuracy'

const FOLLOWED_RANKING_SIZE = 8
const FOLLOWED_SCORE_SIZE = 5
const FEED_CARD_FOOTPRINT = 107
const LOW_MID_CATEGORY_ID = 'b0000000-0000-0000-0000-000000000004'

const authStore = useAuthStore()
const categoryStore = useCategoryStore()
const modifierStore = useModifierStore()

const rankingLoading = ref(false)
const scoresLoading = ref(false)
const rankingPageData = ref<Page<LeaderboardResponse> | null>(null)
const scorePageData = ref<Page<ScoreResponse> | null>(null)
const rankingPage = ref(1)
const scorePage = ref(1)

const tick = ref(0)
let tickInterval: ReturnType<typeof setInterval>
onMounted(() => { tickInterval = setInterval(() => tick.value++, 60_000) })
onUnmounted(() => clearInterval(tickInterval))

const scoreMode = ref<ScoreRelationType>('follower')
const scoreTabs: Tab[] = [
  { key: 'follower', label: 'Following' },
  { key: 'rival', label: 'Rivals' },
]

const filtersOpen = ref(false)
const sortField = ref<ScoreSortField>('timeSet')
const sortDir = ref<SortDirection>('desc')
const filterCategoryId = ref<string | undefined>(undefined)

const sortOptions: { key: ScoreSortField; label: string }[] = [
  { key: 'timeSet', label: 'Date' },
  { key: 'ap', label: 'AP' },
  { key: 'accuracy', label: 'Accuracy' },
]

const hasActiveFilters = computed(() =>
  sortField.value !== 'timeSet' || sortDir.value !== 'desc' || filterCategoryId.value !== undefined,
)

const feedMinHeight = computed(() => `${FOLLOWED_SCORE_SIZE * FEED_CARD_FOOTPRINT}px`)

const filterCategories = computed(() =>
  categoryStore.categoryInfoList.filter((c) => {
    if (c.code === 'overall' || c.code === 'xp') return false
    if (categoryStore.getCategoryId(c.code) === LOW_MID_CATEGORY_ID) return false
    return true
  }),
)

const modalOpen = ref(false)
const modalScore = ref<ScoreDisplay | null>(null)
const modalUserId = ref('')

const accent = computed(() => categoryStore.getAccent('overall'))

const rankingColumns: TableColumn[] = [
  { key: 'rank', label: 'Rank', align: 'right', mono: true, width: '60px' },
  { key: 'player', label: 'Player', align: 'left' },
  { key: 'ap', label: 'AP', align: 'right', mono: true, width: '92px' },
  { key: 'avgAccuracy', label: 'Avg Acc', align: 'right', mono: true, width: '84px' },
]

const rankingRows = computed<Record<string, unknown>[]>(() => {
  const page = rankingPageData.value
  if (!page) return []
  return page.content.map((entry) => {
    const player = toPlayerDisplay(entry)
    return {
      userId: player.userId,
      rank: player.rank,
      name: player.name,
      country: player.country,
      avatarUrl: player.avatarUrl,
      avatarFallbackUrl: player.avatarFallbackUrl,
      ap: player.ap,
      avgAccuracy: player.avgAccuracy,
      playerInactive: player.playerInactive,
    }
  })
})

const scoreFeedEntries = computed<ScoreFeedEntry[]>(() => {
  const page = scorePageData.value
  if (!page) return []
  return page.content.map((score) => ({
    key: score.id,
    userId: score.userId,
    userName: score.userName,
    avatarUrl: score.cdnAvatarUrl ?? score.avatarUrl ?? '',
    avatarFallbackUrl: score.cdnAvatarUrl && score.avatarUrl && score.cdnAvatarUrl !== score.avatarUrl ? score.avatarUrl : null,
    country: score.country ?? '',
    mapId: score.mapId,
    mapDifficultyId: score.mapDifficultyId,
    beatsaverCode: score.beatsaverCode,
    characteristic: score.characteristic,
    rawDifficulty: score.difficulty,
    mapName: score.songName ?? 'Unknown Map',
    artistName: score.songAuthor ?? '',
    mapAuthor: score.mapAuthor ?? '',
    coverUrl: score.cdnCoverUrl ?? score.coverUrl ?? '',
    coverFallbackUrl: score.cdnCoverUrl && score.coverUrl && score.cdnCoverUrl !== score.coverUrl ? score.coverUrl : null,
    difficulty: formatDifficulty(score.difficulty),
    categoryCode: categoryStore.getCategoryCode(score.categoryId) ?? 'overall',
    rank: score.rank,
    score: score.score,
    accuracy: score.accuracy,
    ap: score.ap,
    weightedAp: score.weightedAp,
    modifiers: modifierStore.resolveModifierCodes(score.modifierIds),
    misses: score.misses,
    badCuts: score.badCuts,
    wallHits: score.wallHits,
    bombHits: score.bombHits,
    streak115: score.streak115,
    timeSet: score.timeSet,
    blScoreId: score.blScoreId ?? undefined,
  }))
})

const scoreTotalPages = computed(() => scorePageData.value?.totalPages ?? 0)
const rankingTotalPages = computed(() => rankingPageData.value?.totalPages ?? 0)

function toScoreDisplay(entry: ScoreFeedEntry): ScoreDisplay {
  return {
    scoreId: entry.key,
    mapId: entry.mapId,
    mapDifficultyId: entry.mapDifficultyId,
    beatsaverCode: entry.beatsaverCode,
    characteristic: entry.characteristic,
    rawDifficulty: entry.rawDifficulty,
    mapName: entry.mapName,
    artistName: entry.artistName,
    difficulty: entry.difficulty,
    categoryCode: entry.categoryCode,
    coverUrl: entry.coverUrl,
    leaderboardRank: entry.rank,
    score: entry.score,
    accuracy: entry.accuracy,
    ap: entry.ap,
    weightedAp: entry.weightedAp,
    complexity: null,
    modifiers: entry.modifiers,
    date: entry.timeSet,
    misses: entry.misses,
    badCuts: entry.badCuts,
    wallHits: entry.wallHits,
    bombHits: entry.bombHits,
    streak115: entry.streak115,
    blScoreId: entry.blScoreId,
    userName: entry.userName,
    mapAuthor: entry.mapAuthor,
  }
}

function onSelectScore(entry: ScoreFeedEntry) {
  modalScore.value = toScoreDisplay(entry)
  modalUserId.value = entry.userId
  modalOpen.value = true
}

function resetData() {
  rankingPageData.value = null
  scorePageData.value = null
}

async function ensureCategories() {
  if (!categoryStore.loaded) await categoryStore.fetchCategories()
}

async function fetchRanking() {
  if (!authStore.isLoggedIn) {
    rankingPageData.value = null
    return
  }

  await ensureCategories()
  const categoryId = categoryStore.getCategoryId('overall')
  if (!categoryId) {
    rankingPageData.value = null
    return
  }

  rankingLoading.value = true
  try {
    rankingPageData.value = await getLeaderboard(categoryId, {
      page: rankingPage.value - 1,
      size: FOLLOWED_RANKING_SIZE,
      sort: 'ranking,asc',
      relation: scoreMode.value,
      inactiveUsers: true,
    })
  } catch {
    rankingPageData.value = null
  } finally {
    rankingLoading.value = false
  }
}

async function fetchScores() {
  if (!authStore.isLoggedIn) {
    scorePageData.value = null
    return
  }

  scoresLoading.value = true
  try {
    scorePageData.value = await getRelationScores({
      type: scoreMode.value,
      includePrincipal: true,
      categoryId: filterCategoryId.value,
      page: scorePage.value - 1,
      size: FOLLOWED_SCORE_SIZE,
      sort: `${sortField.value},${sortDir.value}`,
    })
  } catch {
    scorePageData.value = null
  } finally {
    scoresLoading.value = false
  }
}

async function fetchActivity() {
  if (!authStore.isLoggedIn) {
    resetData()
    return
  }
  await Promise.all([fetchRanking(), fetchScores()])
}

function buildPlayerProfileRoute(userId: string): RouteLocationRaw {
  return { name: 'player-profile', params: { userId } }
}

function buildRankingPlayerRoute(row: Record<string, unknown>): RouteLocationRaw {
  return buildPlayerProfileRoute(row.userId as string)
}

watch(
  () => authStore.isLoggedIn,
  () => {
    rankingPage.value = 1
    scorePage.value = 1
    void fetchActivity()
  },
  { immediate: true },
)

watch(
  () => categoryStore.loaded,
  (loaded) => {
    if (loaded && authStore.isLoggedIn) void fetchRanking()
  },
)

watch(scorePage, () => {
  if (authStore.isLoggedIn) void fetchScores()
})

watch(rankingPage, () => {
  if (authStore.isLoggedIn) void fetchRanking()
})

watch(scoreMode, () => {
  rankingPage.value = 1
  scorePage.value = 1
  void fetchRanking()
  void fetchScores()
})

watch([sortField, sortDir, filterCategoryId], () => {
  scorePage.value = 1
  void fetchScores()
})
</script>

<template>
  <section v-if="authStore.isLoggedIn" class="followed-activity" :style="{ '--accent': accent }">
    <div class="followed-activity__panel">
      <div class="followed-activity__header">
        <h2 class="followed-activity__title">{{ scoreMode === 'follower' ? 'Followed Ranking' : 'Rival Ranking' }}</h2>
        <BaseTabs :tabs="scoreTabs" :model-value="scoreMode" class="followed-activity__feed-tabs" @update:model-value="scoreMode = $event as ScoreRelationType" />
      </div>

      <div :class="{ 'followed-activity__ranking--loading': rankingLoading && rankingPageData }">
      <DataTable
        :columns="rankingColumns"
        :rows="rankingRows"
        :loading="rankingLoading && !rankingPageData"
        :loading-rows="FOLLOWED_RANKING_SIZE"
        row-key="userId"
        row-clickable
        :row-to="buildRankingPlayerRoute"
        :empty-message="scoreMode === 'follower' ? 'No followed players ranked' : 'No rivals ranked'"
      >
        <template #cell-rank="{ value }">
          <span class="followed-activity__rank" :class="getRankClass(value as number)">#{{ value }}</span>
        </template>

        <template #cell-player="{ row }">
          <PlayerTooltipTrigger
            :user-id="(row.userId as string)"
            :user-name="(row.name as string)"
            :avatar-url="(row.avatarUrl as string)"
            :avatar-fallback-url="(row.avatarFallbackUrl as string | null | undefined) ?? null"
            :country="(row.country as string)"
            class="followed-activity__player"
          >
            <GlowImage :src="(row.avatarUrl as string)" :alt="(row.name as string)" :size="28"
              :fallback-src="(row.avatarFallbackUrl as string | null | undefined) ?? null" />
            <span class="followed-activity__player-name">{{ row.name }}</span>
            <CountryFlag :country="(row.country as string)" />
          </PlayerTooltipTrigger>
        </template>

        <template #cell-ap="{ value }">
          <span class="followed-activity__ap">{{ (value as number).toFixed(2) }}</span>
        </template>

        <template #cell-avgAccuracy="{ value }">
          <template v-if="value != null">{{ ((value as number) * 100).toFixed(2) }}%</template>
          <template v-else>-</template>
        </template>

        <template #mobile-card="{ row }">
          <RouterLink :to="buildRankingPlayerRoute(row)" class="followed-activity__player-card">
            <span class="followed-activity__rank" :class="getRankClass(row.rank as number)">#{{ row.rank }}</span>
            <GlowImage :src="(row.avatarUrl as string)" :alt="(row.name as string)" :size="28"
              :fallback-src="(row.avatarFallbackUrl as string | null | undefined) ?? null" />
            <span class="followed-activity__player-name">{{ row.name }}</span>
            <CountryFlag :country="(row.country as string)" />
            <span class="followed-activity__ap">{{ (row.ap as number).toFixed(2) }}</span>
          </RouterLink>
        </template>
      </DataTable>
      </div>

      <PaginationControls
        v-if="rankingTotalPages > 1"
        :page="rankingPage"
        :total-pages="rankingTotalPages"
        :sibling-count="1"
        @update:page="rankingPage = $event"
      />
    </div>

    <div class="followed-activity__panel followed-activity__panel--scores">
      <div class="followed-activity__header">
        <h2 class="followed-activity__title">Activity Feed</h2>
        <div class="followed-activity__feed-controls">
          <FilterPopover :open="filtersOpen" @update:open="filtersOpen = $event">
            <template #trigger>
              <FilterButton :active="filtersOpen || hasActiveFilters" :has-indicator="hasActiveFilters" />
            </template>
            <div class="feed-filters">
              <div class="feed-filters__group">
                <span class="feed-filters__label">Sort by</span>
                <div class="feed-filters__chips">
                  <button
                    v-for="opt in sortOptions"
                    :key="opt.key"
                    class="feed-filters__chip"
                    :class="{ 'feed-filters__chip--active': sortField === opt.key }"
                    @click="sortField = opt.key"
                  >{{ opt.label }}</button>
                </div>
              </div>
              <div class="feed-filters__group">
                <span class="feed-filters__label">Direction</span>
                <div class="feed-filters__chips">
                  <button class="feed-filters__chip" :class="{ 'feed-filters__chip--active': sortDir === 'desc' }" @click="sortDir = 'desc'">Descending</button>
                  <button class="feed-filters__chip" :class="{ 'feed-filters__chip--active': sortDir === 'asc' }" @click="sortDir = 'asc'">Ascending</button>
                </div>
              </div>
              <div class="feed-filters__group">
                <span class="feed-filters__label">Category</span>
                <div class="feed-filters__chips">
                  <button class="feed-filters__chip" :class="{ 'feed-filters__chip--active': filterCategoryId === undefined }" @click="filterCategoryId = undefined">All</button>
                  <button
                    v-for="cat in filterCategories"
                    :key="cat.code"
                    class="feed-filters__chip"
                    :class="{ 'feed-filters__chip--active': filterCategoryId === categoryStore.getCategoryId(cat.code) }"
                    :style="filterCategoryId === categoryStore.getCategoryId(cat.code) ? { '--chip-accent': cat.accent } : undefined"
                    @click="filterCategoryId = categoryStore.getCategoryId(cat.code)"
                  >{{ cat.name }}</button>
                </div>
              </div>
            </div>
          </FilterPopover>
        </div>
      </div>

      <div class="followed-activity__feed-body">
        <div v-if="scoresLoading && !scorePageData" class="followed-activity__feed-loading">
          <div v-for="i in FOLLOWED_SCORE_SIZE" :key="i" class="followed-activity__feed-skeleton" />
        </div>

        <div v-else-if="scoreFeedEntries.length === 0" class="followed-activity__feed-empty">
          No followed scores found
        </div>

        <div v-else class="followed-activity__feed" :class="{ 'followed-activity__feed--loading': scoresLoading }">
          <ScoreFeedCard
            v-for="entry in scoreFeedEntries"
            :key="entry.key"
            :entry="entry"
            :tick="tick"
            @select="onSelectScore"
          />
        </div>
      </div>

      <PaginationControls
        v-if="scoreTotalPages > 1"
        :page="scorePage"
        :total-pages="scoreTotalPages"
        :sibling-count="2"
        @update:page="scorePage = $event"
      />
    </div>

    <ScoreDetailModal
      :open="modalOpen"
      :score="modalScore"
      :user-id="modalUserId"
      @close="modalOpen = false"
    />
  </section>
</template>

<style scoped>
.followed-activity {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: var(--space-lg);
  align-items: start;
  width: 100%;
}

.followed-activity :deep(.data-table) {
  table-layout: fixed;
}

.followed-activity :deep(.data-table__th),
.followed-activity :deep(.data-table__td) {
  padding-left: var(--space-sm);
  padding-right: var(--space-sm);
}

.followed-activity :deep(.data-table__cell-link) {
  padding-left: var(--space-sm);
  padding-right: var(--space-sm);
}

.followed-activity__panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  min-width: 0;
}

.followed-activity__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
}

.followed-activity__feed-controls {
  display: flex;
  align-items: center;
}

.followed-activity__feed-tabs {
  border-bottom: none;
}

.followed-activity__feed-tabs :deep(.base-tabs__tab) {
  padding: var(--space-xs) var(--space-sm);
  font-size: var(--text-caption);
}

.feed-filters {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.feed-filters__group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.feed-filters__label {
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.feed-filters__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.feed-filters__chip {
  padding: 3px var(--space-sm);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--text-caption);
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
}

.feed-filters__chip:hover {
  background: var(--bg-base);
  color: var(--text-primary);
}

.feed-filters__chip--active {
  border-color: var(--chip-accent, var(--accent));
  color: var(--chip-accent, var(--accent));
  background: color-mix(in srgb, var(--chip-accent, var(--accent)) 10%, transparent);
}

.followed-activity__title {
  margin: 0;
  font-size: var(--text-section-heading);
  font-weight: 700;
  color: var(--text-primary);
}

.followed-activity__rank {
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
}

.followed-activity__rank.rank--gold {
  color: var(--tier-gold);
}

.followed-activity__rank.rank--silver {
  color: var(--tier-silver);
}

.followed-activity__rank.rank--bronze {
  color: var(--tier-bronze);
}

.followed-activity__player {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-width: 0;
}

.followed-activity__player-name {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.followed-activity__ap {
  color: var(--accent);
  font-weight: 600;
}

.followed-activity__player-card {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  min-height: 48px;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--bg-overlay);
  border-left: 2px solid transparent;
  border-radius: var(--radius-card);
  background: var(--bg-surface);
  color: inherit;
  text-align: left;
  text-decoration: none;
  transition: border-color 120ms ease;
}

.followed-activity__player-card:hover {
  border-left-color: var(--accent);
}

.followed-activity__feed-body {
  display: flex;
  flex-direction: column;
}

.followed-activity__feed {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.followed-activity__feed--loading {
  opacity: 0.5;
  pointer-events: none;
  transition: opacity 120ms ease;
}

.followed-activity__ranking--loading {
  opacity: 0.5;
  pointer-events: none;
  transition: opacity 120ms ease;
}

.followed-activity__feed :deep(.feed-card) {
  margin-top: 31px;
}

.followed-activity__feed :deep(.feed-card:first-child) {
  margin-top: 29px;
}

.followed-activity__feed :deep(.feed-card__body) {
  padding: var(--space-xs) var(--space-sm);
  column-gap: var(--space-sm);
  row-gap: 0;
  grid-template-columns: 40px 36px 1fr auto;
}

.followed-activity__feed :deep(.feed-card__info) {
  margin-left: var(--space-lg);
}

.followed-activity__feed :deep(.feed-card__stats-mid) {
  display: none;
}

.followed-activity__feed :deep(.feed-card__stats-bottom) {
  gap: var(--space-xs);
}

.followed-activity__feed-loading {
  display: flex;
  flex-direction: column;
  gap: 31px;
  padding-top: 29px;
  min-height: v-bind(feedMinHeight);
}

.followed-activity__feed-skeleton {
  height: 64px;
  border-radius: var(--radius-card);
  background: var(--bg-surface);
  animation: shimmer 1.4s ease-in-out infinite;
}

@keyframes shimmer {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.followed-activity__feed-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: v-bind(feedMinHeight);
  padding: var(--space-3xl) var(--space-md);
  text-align: center;
  color: var(--text-secondary);
}

@media (max-width: 960px) {
  .followed-activity {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 767px) {
  .followed-activity__header {
    align-items: flex-start;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .followed-activity__feed :deep(.feed-card__stats) {
    margin-left: var(--space-lg);
  }
}
</style>
