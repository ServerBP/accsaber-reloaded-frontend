<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import BaseTabs from '@/components/common/BaseTabs.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import PaginationControls from '@/components/common/PaginationControls.vue'
import SearchBox from '@/components/common/SearchBox.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import CountryFlag from '@/components/domain/CountryFlag.vue'
import { onAvatarError, pickAvatarFallback, pickAvatarUrl } from '@/composables/useAvatarFallback'
import { getApiErrorMessage } from '@/api/client'
import type {
  CampaignDetailResponse,
  CampaignLeaderboardEntry,
  CampaignLeaderboardPlayer,
  CampaignNodeScoreEntry,
} from '@/types/api/campaigns'
import type { CampaignLeaderboardBoard } from '@/types/enums'
import { formatRelativeDate } from '@/utils/formatters'
import { formatDifficulty } from '@/utils/mappers'
import { getRankClass } from '@/utils/ranking'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  campaign: CampaignDetailResponse
  nodeId: string | null
  spectatingUserId?: string | null
}>()

const emit = defineEmits<{
  'update:nodeId': [id: string | null]
  spectate: [player: CampaignLeaderboardPlayer]
}>()

const PAGE_SIZE = 50
const DESKTOP_QUERY = '(min-width: 861px)'

const isDesktop = ref(true)
const open = ref(false)

let mql: MediaQueryList | null = null

function onViewportChange(e: MediaQueryListEvent) {
  isDesktop.value = e.matches
  if (!e.matches) open.value = false
}

onMounted(() => {
  mql = window.matchMedia(DESKTOP_QUERY)
  isDesktop.value = mql.matches
  mql.addEventListener('change', onViewportChange)
})

onUnmounted(() => {
  mql?.removeEventListener('change', onViewportChange)
  document.body.style.overflow = ''
})

watch([open, isDesktop], ([o, desktop]) => {
  document.body.style.overflow = o && !desktop ? 'hidden' : ''
})

const BOARD_TABS = [
  { key: 'COMPLETIONS', label: 'First to finish' },
  { key: 'AVG_ACCURACY', label: 'Avg acc' },
  { key: 'AVG_AP', label: 'Avg AP' },
  { key: 'PROGRESS', label: 'Progress' },
]

const activeBoard = ref<CampaignLeaderboardBoard>('COMPLETIONS')
const search = ref('')
const page = ref(0)
const totalPages = ref(1)
const loading = ref(false)
const error = ref<string | null>(null)
const entries = ref<CampaignLeaderboardEntry[]>([])
const nodeEntries = ref<CampaignNodeScoreEntry[]>([])

let fetchSeq = 0

const drillNode = computed(() =>
  props.nodeId
    ? (props.campaign.difficulties.find((d) => d.id === props.nodeId) ?? null)
    : null,
)

const appliedSearch = computed(() =>
  activeBoard.value === 'PROGRESS' && !props.nodeId ? search.value.trim() : '',
)

const queryKey = computed(
  () =>
    `${props.campaign.id}|${props.nodeId ?? ''}|${activeBoard.value}|${appliedSearch.value}|${page.value}`,
)

async function loadBoard() {
  if (!props.campaign.id) return
  const seq = ++fetchSeq
  loading.value = true
  error.value = null
  try {
    const { getCampaignLeaderboard, getCampaignNodeLeaderboard } = await import('@/api/campaigns')
    if (props.nodeId) {
      const result = await getCampaignNodeLeaderboard(props.campaign.id, props.nodeId, {
        page: page.value,
        size: PAGE_SIZE,
      })
      if (seq !== fetchSeq) return
      nodeEntries.value = result.content
      totalPages.value = result.totalPages || 1
    } else {
      const result = await getCampaignLeaderboard(props.campaign.id, {
        board: activeBoard.value,
        search: appliedSearch.value || undefined,
        page: page.value,
        size: PAGE_SIZE,
      })
      if (seq !== fetchSeq) return
      entries.value = result.content
      totalPages.value = result.totalPages || 1
    }
  } catch (err) {
    if (seq !== fetchSeq) return
    error.value = getApiErrorMessage(err, 'Failed to load the leaderboard')
  } finally {
    if (seq === fetchSeq) loading.value = false
  }
}

watch([activeBoard, () => props.nodeId, appliedSearch], () => {
  page.value = 0
})

watch(
  queryKey,
  () => {
    void loadBoard()
  },
  { immediate: true },
)

watch(
  () => props.nodeId,
  (id) => {
    if (id && isDesktop.value) open.value = true
  },
)

const emptyMessage = computed(() => {
  if (props.nodeId) return 'No scores on this map yet.'
  if (activeBoard.value === 'COMPLETIONS') return 'No completions yet.'
  if (activeBoard.value === 'PROGRESS') {
    return appliedSearch.value ? 'No players match that search.' : "No one's playing yet."
  }
  return 'No qualifying scores yet.'
})

const isEmpty = computed(() =>
  props.nodeId ? nodeEntries.value.length === 0 : entries.value.length === 0,
)

function avatarUrlFor(player: CampaignLeaderboardPlayer): string {
  return pickAvatarUrl(player)
}

function handleAvatarError(player: CampaignLeaderboardPlayer) {
  return onAvatarError(pickAvatarFallback(player))
}

function pct(value?: number): string {
  return value != null ? `${(value * 100).toFixed(2)}%` : '-'
}

function apText(value?: number): string {
  return value != null ? `${value.toFixed(2)} AP` : '-'
}

function progressPct(entry: CampaignLeaderboardEntry): number {
  if (!entry.totalNodes) return 0
  return Math.min(100, Math.round(((entry.completedNodes ?? 0) / entry.totalNodes) * 100))
}

function goBack() {
  emit('update:nodeId', null)
}

function isSpectating(player: CampaignLeaderboardPlayer): boolean {
  return !!props.spectatingUserId && props.spectatingUserId === player.userId
}
</script>

<template>
  <div class="lb" :class="{ 'lb--open': open, 'lb--desktop': isDesktop }">
    <button
      v-if="!open"
      type="button"
      class="lb__opener"
      aria-label="Open leaderboard"
      @click="open = true"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
      Leaderboard
    </button>

    <div v-if="open && !isDesktop" class="lb__backdrop" aria-hidden="true" @click="open = false" />

    <aside v-if="open" class="lb__panel" aria-label="Campaign leaderboard">
      <header class="lb__head">
        <template v-if="drillNode">
          <button type="button" class="lb__back" aria-label="Back to campaign boards" @click="goBack">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <div class="lb__head-meta">
            <h2 class="lb__title">{{ drillNode.songName }}</h2>
            <p class="lb__subtitle">{{ formatDifficulty(drillNode.difficulty) }} · map scores</p>
          </div>
        </template>
        <h2 v-else class="lb__title">Leaderboard</h2>
        <button
          type="button"
          class="lb__collapse"
          :aria-label="isDesktop ? 'Collapse leaderboard' : 'Close leaderboard'"
          @click="open = false"
        >
          <svg
            v-if="isDesktop"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <svg
            v-else
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </header>

      <BaseTabs
        v-if="!drillNode"
        class="lb__tabs"
        :tabs="BOARD_TABS"
        :model-value="activeBoard"
        @update:model-value="activeBoard = $event as CampaignLeaderboardBoard"
      />

      <SearchBox
        v-if="!drillNode && activeBoard === 'PROGRESS'"
        class="lb__search"
        :model-value="search"
        placeholder="Search players..."
        @update:model-value="search = $event"
      />

      <div class="lb__list">
        <template v-if="loading">
          <SkeletonLoader v-for="i in 8" :key="i" variant="table-row" />
        </template>

        <div v-else-if="error" class="lb__error">
          <p role="alert">{{ error }}</p>
          <BaseButton size="sm" @click="loadBoard">Retry</BaseButton>
        </div>

        <EmptyState v-else-if="isEmpty" :message="emptyMessage" />

        <template v-else-if="drillNode">
          <button
            v-for="entry in nodeEntries"
            :key="entry.player.userId"
            type="button"
            class="lb__row"
            :class="{ 'lb__row--active': isSpectating(entry.player) }"
            :aria-current="isSpectating(entry.player) ? 'true' : undefined"
            :title="`View ${entry.player.userName}'s run`"
            @click="emit('spectate', entry.player)"
          >
            <span class="lb__rank" :class="getRankClass(entry.rank)">#{{ entry.rank }}</span>
            <img
              class="lb__avatar"
              :src="avatarUrlFor(entry.player)"
              :alt="entry.player.userName"
              loading="lazy"
              decoding="async"
              @error="handleAvatarError(entry.player)($event)"
            />
            <span class="lb__who">
              <span class="lb__name">
                {{ entry.player.userName }}
                <CountryFlag v-if="entry.player.country" :country="entry.player.country" />
              </span>
              <span class="lb__sub">
                {{ apText(entry.ap) }}<template v-if="entry.score != null">
                  · {{ entry.score.toLocaleString() }}</template>
              </span>
            </span>
            <span class="lb__stat">{{ pct(entry.accuracy) }}</span>
          </button>
        </template>

        <template v-else>
          <button
            v-for="entry in entries"
            :key="entry.player.userId"
            type="button"
            class="lb__row"
            :class="{
              'lb__row--tall': activeBoard === 'PROGRESS',
              'lb__row--active': isSpectating(entry.player),
            }"
            :aria-current="isSpectating(entry.player) ? 'true' : undefined"
            :title="`View ${entry.player.userName}'s run`"
            @click="emit('spectate', entry.player)"
          >
            <span
              v-if="entry.rank != null"
              class="lb__rank"
              :class="getRankClass(entry.rank)"
            >#{{ entry.rank }}</span>
            <img
              class="lb__avatar"
              :src="avatarUrlFor(entry.player)"
              :alt="entry.player.userName"
              loading="lazy"
              decoding="async"
              @error="handleAvatarError(entry.player)($event)"
            />

            <template v-if="activeBoard === 'PROGRESS'">
              <span class="lb__who">
                <span class="lb__name">
                  {{ entry.player.userName }}
                  <CountryFlag v-if="entry.player.country" :country="entry.player.country" />
                </span>
                <span class="lb__progress">
                  <span class="lb__progress-track" aria-hidden="true">
                    <span
                      class="lb__progress-fill"
                      :style="{ transform: `scaleX(${progressPct(entry) / 100})` }"
                    />
                  </span>
                  <span class="lb__progress-count">
                    {{ entry.completedNodes ?? 0 }}/{{ entry.totalNodes ?? 0 }}
                  </span>
                </span>
              </span>
              <span
                class="lb__pill"
                :class="{ 'lb__pill--done': entry.progressStatus === 'COMPLETED' }"
              >
                {{ entry.progressStatus === 'COMPLETED' ? 'Completed' : 'In progress' }}
              </span>
            </template>

            <template v-else-if="activeBoard === 'COMPLETIONS'">
              <span class="lb__who">
                <span class="lb__name">
                  {{ entry.player.userName }}
                  <CountryFlag v-if="entry.player.country" :country="entry.player.country" />
                </span>
              </span>
              <span
                class="lb__stat lb__stat--date"
                :title="entry.completedAt ? new Date(entry.completedAt).toLocaleString() : undefined"
              >
                {{ entry.completedAt ? formatRelativeDate(entry.completedAt) : '-' }}
              </span>
            </template>

            <template v-else>
              <span class="lb__who">
                <span class="lb__name">
                  {{ entry.player.userName }}
                  <CountryFlag v-if="entry.player.country" :country="entry.player.country" />
                </span>
                <span v-if="entry.nodesCounted != null" class="lb__sub">
                  avg of {{ entry.nodesCounted }} {{ entry.nodesCounted === 1 ? 'node' : 'nodes' }}
                </span>
              </span>
              <span class="lb__stat-col">
                <span class="lb__stat">
                  {{ activeBoard === 'AVG_ACCURACY' ? pct(entry.averageAccuracy) : apText(entry.averageAp) }}
                </span>
                <span class="lb__stat-secondary">
                  {{ activeBoard === 'AVG_ACCURACY' ? apText(entry.averageAp) : pct(entry.averageAccuracy) }}
                </span>
              </span>
            </template>
          </button>
        </template>
      </div>

      <footer v-if="!loading && !error && totalPages > 1" class="lb__foot">
        <PaginationControls
          :page="page + 1"
          :total-pages="totalPages"
          @update:page="page = $event - 1"
        />
      </footer>
    </aside>
  </div>
</template>

<style scoped>
.lb__opener {
  position: absolute;
  top: var(--space-md);
  right: var(--space-md);
  z-index: 6;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
  border: 1px solid var(--bg-overlay);
  border-radius: 4px;
  cursor: pointer;
  pointer-events: auto;
  transition:
    color 120ms ease,
    border-color 120ms ease;
}

.lb__opener:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.lb__panel {
  position: absolute;
  top: var(--space-md);
  right: var(--space-md);
  bottom: var(--space-md);
  z-index: 6;
  display: flex;
  flex-direction: column;
  width: min(340px, calc(100vw - var(--space-md) * 2));
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: 4px;
  pointer-events: auto;
  animation: lb-slide-in 200ms ease-out;
}

@keyframes lb-slide-in {
  from {
    opacity: 0;
    transform: translateX(12px);
  }
}

.lb__head {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md);
  border-bottom: 1px solid var(--bg-overlay);
}

.lb__head-meta {
  flex: 1;
  min-width: 0;
}

.lb__title {
  margin: 0;
  flex: 1;
  min-width: 0;
  font-family: var(--font-sans);
  font-size: 0.9375rem;
  font-weight: 650;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lb__head-meta .lb__title {
  flex: none;
}

.lb__subtitle {
  margin: 1px 0 0;
  font-size: 0.6875rem;
  color: var(--text-tertiary);
}

.lb__back,
.lb__collapse {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  color: var(--text-tertiary);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  cursor: pointer;
  transition:
    color 120ms ease,
    background 120ms ease;
}

.lb__back:hover,
.lb__collapse:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

.lb__tabs {
  padding: 0 var(--space-sm);
}

.lb__tabs :deep(.base-tabs__tab) {
  padding: var(--space-sm) 6px;
  font-size: 0.6875rem;
  font-weight: 600;
}

.lb__search {
  margin: var(--space-sm) var(--space-md) 0;
}

.lb__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-sm) var(--space-sm) var(--space-md);
  display: flex;
  flex-direction: column;
  scrollbar-width: thin;
  scrollbar-color: var(--bg-overlay) transparent;
}

.lb__list::-webkit-scrollbar {
  width: 5px;
}

.lb__list::-webkit-scrollbar-thumb {
  background: var(--bg-overlay);
  border-radius: 3px;
}

.lb__row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: var(--space-sm);
  padding: 6px var(--space-sm);
  font: inherit;
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  color: inherit;
  cursor: pointer;
  transition:
    background 120ms ease,
    border-color 120ms ease;
}

.lb__row:nth-child(even) {
  background: color-mix(in srgb, var(--bg-elevated) 55%, transparent);
}

.lb__row:hover {
  background: var(--bg-elevated);
}

.lb__row:focus-visible {
  outline: none;
  border-color: var(--page-accent, var(--accent));
}

.lb__row--active,
.lb__row--active:nth-child(even) {
  background: var(--bg-elevated);
  border-color: var(--page-accent, var(--accent));
}

.lb__rank {
  flex-shrink: 0;
  min-width: 30px;
  text-align: right;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
}

.lb__rank.rank--gold { color: var(--tier-gold); font-weight: 700; }
.lb__rank.rank--silver { color: var(--tier-silver); font-weight: 700; }
.lb__rank.rank--bronze { color: var(--tier-bronze); font-weight: 700; }

.lb__avatar {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: var(--radius-avatar);
  object-fit: cover;
  background: var(--bg-elevated);
}

.lb__who {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.lb__name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lb__sub {
  font-family: var(--font-mono);
  font-size: 0.625rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lb__stat {
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  color: var(--text-primary);
}

.lb__stat--date {
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  color: var(--text-secondary);
}

.lb__stat-col {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
}

.lb__stat-secondary {
  font-family: var(--font-mono);
  font-size: 0.625rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-tertiary);
}

.lb__progress {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.lb__progress-track {
  position: relative;
  flex: 1;
  max-width: 110px;
  height: 3px;
  background: var(--bg-overlay);
  border-radius: 1px;
  overflow: hidden;
}

.lb__progress-fill {
  position: absolute;
  inset: 0;
  background: var(--page-accent, var(--accent));
  transform-origin: left center;
}

.lb__progress-count {
  font-family: var(--font-mono);
  font-size: 0.625rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
}

.lb__pill {
  flex-shrink: 0;
  padding: 2px 6px;
  font-family: var(--font-sans);
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-secondary);
  border: 1px solid var(--bg-overlay);
  border-radius: 2px;
}

.lb__pill--done {
  color: var(--success);
  border-color: color-mix(in srgb, var(--success) 45%, transparent);
  background: color-mix(in srgb, var(--success) 10%, transparent);
}

.lb__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xl) var(--space-md);
}

.lb__error p {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--error);
  text-align: center;
  line-height: 1.4;
}

.lb__foot {
  display: flex;
  justify-content: center;
  padding: var(--space-sm);
  border-top: 1px solid var(--bg-overlay);
}

.lb__backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

@media (max-width: 860px) {
  .lb__opener {
    position: fixed;
    top: auto;
    right: var(--space-md);
    bottom: var(--space-md);
    z-index: 89;
  }

  .lb__panel {
    position: fixed;
    top: auto;
    right: 0;
    left: 0;
    bottom: 0;
    z-index: 91;
    width: auto;
    height: min(75vh, 640px);
    border-radius: 8px 8px 0 0;
    border-bottom: none;
    background: var(--bg-elevated);
    animation: lb-sheet-in 200ms ease-out;
  }

  @keyframes lb-sheet-in {
    from {
      transform: translateY(24px);
      opacity: 0;
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .lb__panel {
    animation: none;
  }
}
</style>
