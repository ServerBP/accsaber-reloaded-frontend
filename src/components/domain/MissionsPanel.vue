<script setup lang="ts">
import { ApiError, getApiErrorMessage } from '@/api/client'
import { getDifficulty } from '@/api/maps'
import EmptyState from '@/components/common/EmptyState.vue'
import PaginationControls from '@/components/common/PaginationControls.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import MissionCard from '@/components/domain/MissionCard.vue'
import type { MissionPool, MissionResponse } from '@/types/api/missions'
import {
  BAND_RANK,
  formatMissionCountdown,
  POOL_LABEL,
  POOL_ORDER,
} from '@/utils/missions'
import { computed, nextTick, onMounted, onUnmounted, ref, useId, watch } from 'vue'

const props = defineProps<{
  active: boolean
  loadActive: () => Promise<MissionResponse[]>
  loadHistory: () => Promise<MissionResponse[]>
  hideTitle?: boolean
  selfView?: boolean
  hideEventPool?: boolean
}>()

const emit = defineEmits<{
  navigate: []
}>()

const uid = useId()
const activeTabId = `${uid}-tab-active`
const historyTabId = `${uid}-tab-history`
const activePanelId = `${uid}-panel-active`
const historyPanelId = `${uid}-panel-history`

const tab = ref<'active' | 'history'>('active')
const activeTabRef = ref<HTMLButtonElement | null>(null)
const historyTabRef = ref<HTMLButtonElement | null>(null)

const missionsById = ref(new Map<string, MissionResponse>())
const loadingActive = ref(false)
const loadingHistory = ref(false)
const loadedActive = ref(false)
const loadedHistory = ref(false)
const activeError = ref<string | null>(null)
const historyError = ref<string | null>(null)

interface MissionMapLink {
  mapId: string
  beatsaverCode: string | null
  difficulty: string
  characteristic: string
}

const mapLinkByDifficulty = ref(new Map<string, MissionMapLink>())

const now = ref(Date.now())
let nowTimer: number | null = null

const errorMessage = computed(() => activeError.value ?? historyError.value)

const allMissions = computed(() => {
  const list = Array.from(missionsById.value.values())
  return props.hideEventPool ? list.filter((m) => m.pool !== 'event') : list
})

const activeList = computed(() =>
  allMissions.value.filter((m) => isWithinWindow(m, now.value)),
)

const historyList = computed(() =>
  allMissions.value.filter((m) => !isWithinWindow(m, now.value)),
)

const hasActive = computed(() => activeList.value.length > 0)
const hasHistory = computed(() => historyList.value.length > 0)

const hasDaily = computed(() => activeList.value.some((m) => m.pool === 'daily'))

const showInactiveNotice = computed(
  () =>
    Boolean(props.selfView)
    && loadedActive.value
    && loadedHistory.value
    && !errorMessage.value
    && !hasDaily.value,
)

const grouped = computed(() => {
  const map = new Map<MissionPool, MissionResponse[]>()
  for (const pool of POOL_ORDER) map.set(pool, [])
  for (const m of activeList.value) {
    const bucket = map.get(m.pool)
    if (bucket) bucket.push(m)
  }
  return POOL_ORDER
    .map((pool) => ({ pool, missions: sortByBand(map.get(pool) ?? []) }))
    .filter((group) => group.missions.length > 0)
})

const sortedHistory = computed(() => sortByBand(historyList.value))

const HISTORY_PAGE_SIZE = 10
const historyPage = ref(1)

const historyTotalPages = computed(() =>
  Math.max(1, Math.ceil(sortedHistory.value.length / HISTORY_PAGE_SIZE)),
)

const pagedHistory = computed(() => {
  const start = (historyPage.value - 1) * HISTORY_PAGE_SIZE
  return sortedHistory.value.slice(start, start + HISTORY_PAGE_SIZE)
})

watch(historyTotalPages, (total) => {
  if (historyPage.value > total) historyPage.value = total
})

function expiryMs(mission: MissionResponse): number {
  return mission.expiresAt ? new Date(mission.expiresAt).getTime() : Number.NaN
}

function isWithinWindow(mission: MissionResponse, nowMs: number): boolean {
  const expiresAt = expiryMs(mission)
  if (!Number.isFinite(expiresAt)) return mission.status === 'active'
  return expiresAt > nowMs
}

function bandRank(mission: MissionResponse): number {
  return mission.band ? BAND_RANK[mission.band] : Number.MAX_SAFE_INTEGER
}

function sortByBand(missions: MissionResponse[]): MissionResponse[] {
  return [...missions].sort((a, b) => bandRank(a) - bandRank(b))
}

function groupCountdown(missions: MissionResponse[]): string {
  const earliest = missions
    .map(expiryMs)
    .filter((t) => Number.isFinite(t))
    .reduce((min, t) => (t < min ? t : min), Number.POSITIVE_INFINITY)
  if (!Number.isFinite(earliest)) return ''
  return formatMissionCountdown(new Date(earliest).toISOString(), now.value)
}

function isMissionsUnavailable(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 401 || err.status === 404)
}

function mergeMissions(list: MissionResponse[]) {
  const next = new Map(missionsById.value)
  for (const m of list) next.set(m.id, m)
  missionsById.value = next
}

async function resolveMapIds(missions: MissionResponse[]) {
  const pending = new Set<string>()
  for (const m of missions) {
    const diffId = m.targetMapDifficultyId
    if (diffId && !mapLinkByDifficulty.value.has(diffId)) pending.add(diffId)
  }
  if (pending.size === 0) return
  const results = await Promise.allSettled(
    Array.from(pending).map((id) =>
      getDifficulty(id).then((d) => [id, {
        mapId: d.mapId,
        beatsaverCode: d.beatsaverCode,
        difficulty: d.difficulty,
        characteristic: d.characteristic,
      }] as const),
    ),
  )
  const next = new Map(mapLinkByDifficulty.value)
  for (const r of results) {
    if (r.status === 'fulfilled') next.set(r.value[0], r.value[1])
  }
  mapLinkByDifficulty.value = next
}

async function runLoadActive() {
  if (loadingActive.value) return
  loadingActive.value = true
  activeError.value = null
  try {
    const missions = await props.loadActive()
    mergeMissions(missions)
    void resolveMapIds(missions)
  } catch (err) {
    if (!isMissionsUnavailable(err)) {
      activeError.value = getApiErrorMessage(err, 'Failed to load missions')
    }
  } finally {
    loadingActive.value = false
    loadedActive.value = true
  }
}

async function runLoadHistory() {
  if (loadingHistory.value) return
  loadingHistory.value = true
  historyError.value = null
  try {
    const missions = await props.loadHistory()
    mergeMissions(missions)
    void resolveMapIds(missions)
  } catch (err) {
    if (!isMissionsUnavailable(err)) {
      historyError.value = getApiErrorMessage(err, 'Failed to load history')
    }
  } finally {
    loadingHistory.value = false
    loadedHistory.value = true
  }
}

function startTicker() {
  if (nowTimer !== null) return
  now.value = Date.now()
  nowTimer = window.setInterval(() => {
    now.value = Date.now()
  }, 30_000)
}

function stopTicker() {
  if (nowTimer !== null) {
    window.clearInterval(nowTimer)
    nowTimer = null
  }
}

function handleNavigate() {
  emit('navigate')
}

function focusTab(value: 'active' | 'history') {
  const target = value === 'active' ? activeTabRef.value : historyTabRef.value
  target?.focus()
}

function onTabKeydown(e: KeyboardEvent) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return
  e.preventDefault()
  const next: 'active' | 'history' =
    e.key === 'Home' ? 'active'
      : e.key === 'End' ? 'history'
        : tab.value === 'active' ? 'history' : 'active'
  tab.value = next
  void nextTick(() => focusTab(next))
}

function onVisibilityChange() {
  if (document.hidden) {
    stopTicker()
  } else if (props.active) {
    startTicker()
  }
}

watch(
  () => props.active,
  (value) => {
    if (value) {
      if (!document.hidden) startTicker()
      void runLoadActive()
      void runLoadHistory()
    } else {
      stopTicker()
    }
  },
  { immediate: true },
)

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onUnmounted(() => {
  stopTicker()
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<template>
  <div class="missions-panel">
    <header class="missions-panel__head" :class="{ 'missions-panel__head--headless': hideTitle }">
      <h2 v-if="!hideTitle" class="missions-panel__title">Missions</h2>
      <div class="missions-panel__tabs" role="tablist" aria-label="Missions" @keydown="onTabKeydown">
        <button :id="activeTabId" ref="activeTabRef" type="button" role="tab" class="missions-panel__tab"
          :class="{ 'missions-panel__tab--active': tab === 'active' }" :aria-selected="tab === 'active'"
          :aria-controls="activePanelId" :tabindex="tab === 'active' ? 0 : -1"
          @click="tab = 'active'">Active</button>
        <button :id="historyTabId" ref="historyTabRef" type="button" role="tab" class="missions-panel__tab"
          :class="{ 'missions-panel__tab--active': tab === 'history' }" :aria-selected="tab === 'history'"
          :aria-controls="historyPanelId" :tabindex="tab === 'history' ? 0 : -1"
          @click="tab = 'history'">History</button>
      </div>
    </header>

    <div class="missions-panel__body">
      <div v-if="errorMessage" class="missions-panel__error" role="alert">{{ errorMessage }}</div>

      <section v-show="tab === 'active'" :id="activePanelId" role="tabpanel" :aria-labelledby="activeTabId"
        tabindex="0" class="missions-panel__tabpanel">
        <div v-if="(loadingActive || loadingHistory) && !hasActive" class="missions-panel__skeletons">
          <SkeletonLoader variant="card" />
          <SkeletonLoader variant="card" />
        </div>
        <template v-else>
          <div v-if="showInactiveNotice" class="missions-panel__notice" role="status">
            <svg class="missions-panel__notice-icon" width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4" />
              <path d="M12 16h.01" />
            </svg>
            <div class="missions-panel__notice-text">
              <p class="missions-panel__notice-title">Daily missions paused</p>
              <p class="missions-panel__notice-body">
                Your profile is marked inactive, so dailies stopped rolling. Play a ranked map to reactivate it, then
                sign in again to get them back.
              </p>
            </div>
          </div>
          <EmptyState v-if="!hasActive && !showInactiveNotice && !errorMessage" icon="🎆"
            message="No active missions right now. Check back at the next rollover." />
          <div v-else-if="hasActive" class="missions-panel__groups">
            <section v-for="group in grouped" :key="group.pool" class="missions-panel__group">
              <header class="missions-panel__group-head">
                <span class="missions-panel__group-label">{{ POOL_LABEL[group.pool] }}</span>
                <span class="missions-panel__group-meta">resets in {{ groupCountdown(group.missions) }}</span>
              </header>
              <div class="missions-panel__stack">
                <MissionCard v-for="mission in group.missions" :key="mission.id" :mission="mission"
                  :map-link="mission.targetMapDifficultyId ? mapLinkByDifficulty.get(mission.targetMapDifficultyId) ?? null : null"
                  @navigate="handleNavigate" />
              </div>
            </section>
          </div>
        </template>
      </section>

      <section v-show="tab === 'history'" :id="historyPanelId" role="tabpanel" :aria-labelledby="historyTabId"
        tabindex="0" class="missions-panel__tabpanel">
        <div v-if="(loadingActive || loadingHistory) && !hasHistory" class="missions-panel__skeletons">
          <SkeletonLoader variant="card" />
          <SkeletonLoader variant="card" />
        </div>
        <EmptyState v-else-if="!loadingActive && !loadingHistory && !hasHistory && !errorMessage" icon="🏁"
          message="Completed missions will show up here." />
        <template v-else>
          <div class="missions-panel__stack">
            <MissionCard v-for="mission in pagedHistory" :key="mission.id" :mission="mission"
              :map-link="mission.targetMapDifficultyId ? mapLinkByDifficulty.get(mission.targetMapDifficultyId) ?? null : null"
              @navigate="handleNavigate" />
          </div>
          <div v-if="historyTotalPages > 1" class="missions-panel__pagination">
            <PaginationControls :page="historyPage" :total-pages="historyTotalPages"
              @update:page="historyPage = $event" />
          </div>
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped>
.missions-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.missions-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--bg-overlay);
}

.missions-panel__head--headless {
  justify-content: flex-end;
}

.missions-panel__tabpanel:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--accent) 40%, transparent);
  outline-offset: -2px;
}

.missions-panel__title {
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--text-card-title);
  font-weight: 700;
  color: var(--text-primary);
}

.missions-panel__tabs {
  display: flex;
  gap: 2px;
  padding: 2px;
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-btn);
}

.missions-panel__tab {
  padding: 4px var(--space-sm);
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: none;
  border: none;
  border-radius: 2px;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  transition: color 120ms ease, background 120ms ease;
}

.missions-panel__tab:hover {
  color: var(--text-primary);
}

.missions-panel__tab--active {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

.missions-panel__body {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.missions-panel__error {
  margin: var(--space-sm) var(--space-md);
  padding: var(--space-sm) var(--space-md);
  font-size: var(--text-caption);
  color: var(--error);
  background: color-mix(in srgb, var(--error) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--error) 40%, transparent);
  border-radius: var(--radius-btn);
}

.missions-panel__notice {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  margin: var(--space-md) var(--space-md) 0;
  padding: var(--space-sm) var(--space-md);
  background: color-mix(in srgb, var(--warning) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--warning) 40%, transparent);
  border-radius: var(--radius-btn);
}

.missions-panel__notice-icon {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--warning);
}

.missions-panel__notice-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.missions-panel__notice-title {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--warning);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.missions-panel__notice-body {
  margin: 0;
  font-size: var(--text-caption);
  line-height: 1.45;
  color: var(--text-secondary);
}

.missions-panel__skeletons {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-md);
}

.missions-panel__groups {
  display: flex;
  flex-direction: column;
}

.missions-panel__group {
  display: flex;
  flex-direction: column;
}

.missions-panel__group+.missions-panel__group {
  border-top: 1px solid var(--bg-overlay);
}

.missions-panel__group-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md) 4px;
}

.missions-panel__group-label {
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.16em;
}

.missions-panel__group-meta {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--text-tertiary);
}

.missions-panel__stack {
  display: flex;
  flex-direction: column;
}

.missions-panel__pagination {
  padding: var(--space-md);
  border-top: 1px solid var(--bg-overlay);
}
</style>
