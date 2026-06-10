<script setup lang="ts">
import DataTable from '@/components/common/DataTable.vue'
import GlowImage from '@/components/common/GlowImage.vue'
import CountryFlag from '@/components/domain/CountryFlag.vue'
import PlayerTooltipTrigger from '@/components/domain/PlayerTooltipTrigger.vue'
import { useCategoryStore } from '@/stores/categories'
import type { TableColumn } from '@/types/display'
import { formatRelativeDate } from '@/utils/formatters'
import { formatDifficulty } from '@/utils/mappers'
import { buildMapRoute } from '@/utils/mapRoute'
import { getRankClass } from '@/utils/ranking'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

type LeaderboardTab = 'streaks' | 'max-ap' | 'avg-ap' | 'most-retried' | 'grinders' | 'dedication' | 'collectors'

const props = defineProps<{
  columns: TableColumn[]
  rows: Record<string, unknown>[]
  loading: boolean
  activeTab: LeaderboardTab
}>()

const emit = defineEmits<{ 'score-detail': [scoreId: string] }>()

const router = useRouter()
const categoryStore = useCategoryStore()

const isScoreTab = computed(() => props.activeTab === 'streaks' || props.activeTab === 'max-ap')

function categoryDotColor(categoryId: string): string {
  const code = categoryStore.getCategoryCode(categoryId)
  return categoryStore.getAccent(code ?? 'overall')
}

function mapRowRoute(row: Record<string, unknown>) {
  return buildMapRoute({
    beatsaverCode: typeof row.beatsaverCode === 'string' ? row.beatsaverCode : null,
    mapId: row.mapId as string,
    difficulty: typeof row.difficulty === 'string' ? row.difficulty : null,
    difficultyId: typeof row.mapDifficultyId === 'string' ? row.mapDifficultyId : null,
    characteristic: typeof row.characteristic === 'string' ? row.characteristic : null,
  })
}

function rowTo(row: Record<string, unknown>) {
  if (props.activeTab === 'avg-ap' || props.activeTab === 'most-retried') {
    return mapRowRoute(row)
  }
  if (row.userId) return { name: 'player-profile', params: { userId: row.userId as string } }
  return undefined
}

function supersededRowClass(row: Record<string, unknown>) {
  if (isScoreTab.value && row.active === false) return 'data-table__row--superseded'
  return undefined
}

function pushRow(row: Record<string, unknown>) {
  const target = rowTo(row)
  if (target) router.push(target)
}
</script>

<template>
  <DataTable :columns="columns" :rows="rows" :loading="loading" :loading-rows="10" row-clickable :row-to="rowTo"
    row-key="rank" empty-message="No records found" :row-class="supersededRowClass">

    <template #cell-rank="{ value }">
      <span class="rank-cell" :class="getRankClass(value as number)">#{{ value }}</span>
    </template>

    <template #cell-player="{ row }">
      <PlayerTooltipTrigger :user-id="(row.userId as string)" :user-name="(row.userName as string)"
        :avatar-url="(row.avatarUrl as string)"
        :avatar-fallback-url="(row.avatarFallbackUrl as string | null | undefined) ?? null"
        :country="(row.country as string)">
        <div class="player-cell">
          <GlowImage :src="(row.avatarUrl as string)" :alt="(row.userName as string)" :size="32"
            :fallback-src="(row.avatarFallbackUrl as string | null | undefined) ?? null" />
          <span class="player-cell__name">{{ row.userName }}</span>
          <CountryFlag :country="(row.country as string)" />
        </div>
      </PlayerTooltipTrigger>
    </template>

    <template #cell-map="{ row }">
      <router-link :to="mapRowRoute(row)" class="map-cell map-cell--link" @click.stop>
        <GlowImage :src="(row.coverUrl as string)" :alt="(row.songName as string)" :size="32"
          :fallback-src="(row.coverFallbackUrl as string | null | undefined) ?? null" />
        <div class="map-cell__info">
          <div class="map-cell__title-row">
            <span class="map-cell__dot" :style="{ background: categoryDotColor(row.categoryId as string) }" />
            <span class="map-cell__name">{{ row.songName }}</span>
          </div>
          <div class="map-cell__meta">
            <span class="map-cell__mapper">{{ row.mapAuthor }}</span>
            <span class="map-cell__diff">{{ formatDifficulty(row.difficulty as string) }}</span>
          </div>
        </div>
      </router-link>
    </template>

    <template #cell-streak115="{ value }"><span class="stat-accent">{{ value }}</span></template>
    <template #cell-accuracy="{ value }">{{ ((value as number) * 100).toFixed(2) }}%</template>
    <template #cell-ap="{ value }"><span class="stat-accent">{{ (value as number).toFixed(2) }}</span></template>
    <template #cell-averageWeightedAp="{ value }"><span class="stat-accent">{{ (value as number).toFixed(2) }}</span></template>
    <template #cell-supersededCount="{ value }"><span class="stat-accent">{{ (value as number).toLocaleString() }}</span></template>
    <template #cell-improvementCount="{ value }"><span class="stat-accent">{{ (value as number).toLocaleString() }}</span></template>
    <template #cell-milestoneCount="{ value }"><span class="stat-accent">{{ (value as number).toLocaleString() }}</span></template>
    <template #cell-scoreCount="{ value }">{{ (value as number).toLocaleString() }}</template>
    <template #cell-timeSet="{ value }"><span class="date-cell">{{ formatRelativeDate(value as string) }}</span></template>
    <template #cell-latestScoreTimeSet="{ value }"><span class="date-cell">{{ formatRelativeDate(value as string) }}</span></template>

    <template #cell-detail="{ row }">
      <button v-if="isScoreTab" class="detail-btn" aria-label="View score details"
        @click.stop="emit('score-detail', row.id as string)">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 11L5.5 5L8 8L10.5 4L14 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
            stroke-linejoin="round" />
          <path d="M2 13H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </button>
    </template>

    <template #mobile-card="{ row }">
      <div class="stats-card" :class="{ 'stats-card--superseded': isScoreTab && row.active === false }"
        @click="pushRow(row)">
        <span class="stats-card__rank rank-cell" :class="getRankClass(row.rank as number)">#{{ row.rank }}</span>
        <div v-if="row.userName" class="stats-card__player">
          <GlowImage :src="(row.avatarUrl as string)" :alt="(row.userName as string)" :size="28"
            :fallback-src="(row.avatarFallbackUrl as string | null | undefined) ?? null" />
          <span class="stats-card__name">{{ row.userName }}</span>
          <CountryFlag v-if="row.country" :country="(row.country as string)" />
        </div>
        <router-link v-if="row.songName" class="stats-card__map" :to="mapRowRoute(row)" @click.stop>
          <GlowImage :src="(row.coverUrl as string)" :alt="(row.songName as string)" :size="28"
            :fallback-src="(row.coverFallbackUrl as string | null | undefined) ?? null" />
          <div class="stats-card__map-info">
            <span class="stats-card__map-name">{{ row.songName }}</span>
            <span class="stats-card__map-meta"><span class="map-cell__dot"
                :style="{ background: categoryDotColor(row.categoryId as string) }" /> {{ row.mapAuthor }} · {{
                  formatDifficulty(row.difficulty as string) }}</span>
          </div>
        </router-link>
        <span class="stats-card__stat stat-accent">
          <template v-if="activeTab === 'streaks'">{{ row.streak115 }}</template>
          <template v-else-if="activeTab === 'max-ap'">{{ (row.ap as number).toFixed(2) }}</template>
          <template v-else-if="activeTab === 'avg-ap'">{{ (row.averageWeightedAp as number).toFixed(2) }}</template>
          <template v-else-if="activeTab === 'most-retried'">{{ (row.supersededCount as number).toLocaleString() }}</template>
          <template v-else-if="activeTab === 'grinders' || activeTab === 'dedication'">{{ (row.improvementCount as number).toLocaleString() }}</template>
          <template v-else-if="activeTab === 'collectors'">{{ (row.milestoneCount as number).toLocaleString() }}</template>
        </span>
        <button v-if="isScoreTab" class="detail-btn" aria-label="View score details"
          @click.stop="emit('score-detail', row.id as string)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 11L5.5 5L8 8L10.5 4L14 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
              stroke-linejoin="round" />
            <path d="M2 13H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </template>
  </DataTable>
</template>

<style scoped>
.rank-cell {
  font-family: var(--font-mono);
  font-weight: 500;
  color: var(--text-secondary);
}

.rank-cell.rank--gold { color: var(--tier-gold); font-weight: 700; }
.rank-cell.rank--silver { color: var(--tier-silver); font-weight: 700; }
.rank-cell.rank--bronze { color: var(--tier-bronze); font-weight: 700; }

.player-cell {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-width: 0;
}

.player-cell__name {
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.map-cell {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-width: 0;
  text-decoration: none;
  color: inherit;
}

.map-cell--link:hover .map-cell__name {
  color: var(--page-accent);
}

.map-cell__info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 1px;
}

.map-cell__title-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
}

.map-cell__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.map-cell__name {
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 120ms ease;
}

.map-cell__meta {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.map-cell__mapper {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-cell__diff {
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.stat-accent {
  color: var(--page-accent);
  font-weight: 600;
}

.date-cell {
  color: var(--text-secondary);
  font-size: var(--text-caption);
}

.detail-btn {
  position: relative;
  z-index: 2;
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
  transition: color 120ms ease, border-color 120ms ease;
}

.detail-btn:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.stats-card {
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

.stats-card:hover {
  border-left-color: var(--page-accent);
}

.stats-card__rank {
  width: 32px;
  text-align: right;
  flex-shrink: 0;
}

.stats-card__player {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
  flex: 1;
}

.stats-card__name {
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stats-card__stat {
  font-family: var(--font-mono);
  font-weight: 600;
  flex-shrink: 0;
  margin-left: auto;
}

.stats-card__map {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
  text-decoration: none;
  color: inherit;
}

.stats-card__map:hover .stats-card__map-name {
  color: var(--page-accent);
}

.stats-card__map-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 1px;
}

.stats-card__map-name {
  font-size: var(--text-caption);
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 120ms ease;
}

.stats-card__map-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.625rem;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.data-table__row--superseded) {
  opacity: 0.4;
}

.stats-card--superseded {
  opacity: 0.4;
}
</style>
