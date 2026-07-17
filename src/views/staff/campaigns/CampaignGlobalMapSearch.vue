<script setup lang="ts">
import { parseApiError } from '@/api/client'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import FilterButton from '@/components/common/FilterButton.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import { useDebouncedRef } from '@/composables/useDebouncedRef'
import type { ImportCampaignMapRequest } from '@/types/api/campaigns'
import {
  type BeatSaverLeaderboardFilter,
  type BeatSaverMapResponse,
  type BeatSaverOrder,
  type BeatSaverSearchParams,
  type MapLeaderboardIndex,
  fetchBeatSaverMap,
  fetchMapLeaderboardIndex,
  formatBsDifficulty,
  parseBeatSaverCode,
  searchBeatSaver,
} from '@/utils/beatsaver'
import { computed, onMounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    mode?: 'add' | 'repoint'
    initialGenreSlugs?: string[]
    submit: (ids: ImportCampaignMapRequest) => Promise<{ attached: boolean }>
  }>(),
  { mode: 'add', initialGenreSlugs: () => [] },
)

const PAGE_SIZE = 20

const ORDER_OPTIONS: Array<{ value: BeatSaverOrder; label: string }> = [
  { value: 'Relevance', label: 'Relevance' },
  { value: 'Latest', label: 'Latest' },
  { value: 'Rating', label: 'Rating' },
  { value: 'Curated', label: 'Curated' },
  { value: 'Duration', label: 'Duration' },
  { value: 'Random', label: 'Random' },
]

const LEADERBOARD_OPTIONS: Array<{ value: BeatSaverLeaderboardFilter; label: string }> = [
  { value: 'All', label: 'All' },
  { value: 'Ranked', label: 'Ranked' },
  { value: 'BeatLeader', label: 'BeatLeader' },
  { value: 'ScoreSaber', label: 'ScoreSaber' },
]

type AiFilter = 'exclude' | 'include' | 'only'
const AI_OPTIONS: Array<{ value: AiFilter; label: string }> = [
  { value: 'exclude', label: 'No AI maps' },
  { value: 'include', label: 'Include AI maps' },
  { value: 'only', label: 'Only AI maps' },
]

const BOOLEAN_FLAGS: Array<{ key: FlagKey; label: string }> = [
  { key: 'chroma', label: 'Chroma' },
  { key: 'noodle', label: 'Noodle' },
  { key: 'cinema', label: 'Cinema' },
  { key: 'curated', label: 'Curated' },
  { key: 'verified', label: 'Verified mapper' },
  { key: 'fullSpread', label: 'Full spread' },
]
type FlagKey = 'chroma' | 'noodle' | 'cinema' | 'curated' | 'verified' | 'fullSpread'

const query = ref('')
const order = ref<BeatSaverOrder>('Relevance')
const leaderboard = ref<BeatSaverLeaderboardFilter>('All')
const aiFilter = ref<AiFilter>('exclude')
const tags = ref('')

const minNps = ref<number | null>(null)
const maxNps = ref<number | null>(null)
const minBpm = ref<number | null>(null)
const maxBpm = ref<number | null>(null)
const minDuration = ref<number | null>(null)
const maxDuration = ref<number | null>(null)
const minRating = ref<number | null>(null)
const maxRating = ref<number | null>(null)
const flags = ref<Record<FlagKey, boolean>>({
  chroma: false,
  noodle: false,
  cinema: false,
  curated: false,
  verified: false,
  fullSpread: false,
})

const filtersOpen = ref(false)

const docs = ref<BeatSaverMapResponse[]>([])
const page = ref(0)
const loading = ref(false)
const reachedEnd = ref(false)
const isCodeResult = ref(false)
const error = ref<string | null>(null)

const expandedId = ref<string | null>(null)
const resolvedByHash = ref(new Map<string, MapLeaderboardIndex>())
const resolvingHash = ref<string | null>(null)

type ImportState = { status: 'importing' | 'imported' | 'attached' | 'error'; message?: string }
const importStates = ref(new Map<string, ImportState>())

function importKey(mapId: string, diffKey: string): string {
  return `${mapId}|${diffKey}`
}

onMounted(() => {
  if (props.initialGenreSlugs.length > 0) {
    tags.value = props.initialGenreSlugs.join('|')
    filtersOpen.value = true
  }
})

const hasNumericFilters = computed(
  () =>
    minNps.value != null ||
    maxNps.value != null ||
    minBpm.value != null ||
    maxBpm.value != null ||
    minDuration.value != null ||
    maxDuration.value != null ||
    minRating.value != null ||
    maxRating.value != null,
)

const hasActiveFilters = computed(
  () =>
    tags.value.trim().length > 0 ||
    leaderboard.value !== 'All' ||
    aiFilter.value !== 'exclude' ||
    hasNumericFilters.value ||
    Object.values(flags.value).some(Boolean),
)

const canSearch = computed(() => query.value.trim().length > 0 || tags.value.trim().length > 0)

function num(v: number | null): number | undefined {
  return v != null && Number.isFinite(v) ? v : undefined
}

function buildParams(): BeatSaverSearchParams {
  return {
    q: query.value.trim(),
    order: order.value,
    tags: tags.value.trim() || undefined,
    leaderboard: leaderboard.value !== 'All' ? leaderboard.value : undefined,
    automapper: aiFilter.value === 'exclude' ? undefined : aiFilter.value === 'include',
    minNps: num(minNps.value),
    maxNps: num(maxNps.value),
    minBpm: num(minBpm.value),
    maxBpm: num(maxBpm.value),
    minDuration: num(minDuration.value),
    maxDuration: num(maxDuration.value),
    minRating: num(minRating.value),
    maxRating: num(maxRating.value),
    chroma: flags.value.chroma || undefined,
    noodle: flags.value.noodle || undefined,
    cinema: flags.value.cinema || undefined,
    curated: flags.value.curated || undefined,
    verified: flags.value.verified || undefined,
    fullSpread: flags.value.fullSpread || undefined,
  }
}

const searchKey = computed(() =>
  canSearch.value ? JSON.stringify(buildParams()) : '',
)
const debouncedKey = useDebouncedRef(searchKey, 350)

const isBeatSaverUrl = (raw: string) => /beatsaver\.com\/maps\//i.test(raw)

watch(debouncedKey, () => {
  if (canSearch.value) void runSearch(0)
  else {
    docs.value = []
    reachedEnd.value = false
    isCodeResult.value = false
    error.value = null
  }
})

async function runSearch(targetPage: number) {
  loading.value = true
  error.value = null
  page.value = targetPage
  expandedId.value = null

  const raw = query.value.trim()
  const code = parseBeatSaverCode(raw)
  if (code && targetPage === 0) {
    try {
      const map = await fetchBeatSaverMap(code)
      docs.value = [map]
      reachedEnd.value = true
      isCodeResult.value = true
      loading.value = false
      return
    } catch {
      if (isBeatSaverUrl(raw)) {
        docs.value = []
        reachedEnd.value = true
        isCodeResult.value = true
        error.value = 'No BeatSaver map found for that code.'
        loading.value = false
        return
      }
      // Bare hex that isn't a real map id: fall through to a normal text search.
    }
  }

  isCodeResult.value = false
  try {
    const res = await searchBeatSaver(buildParams(), targetPage)
    docs.value = res.docs ?? []
    reachedEnd.value = docs.value.length < PAGE_SIZE
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'BeatSaver search failed'
    docs.value = []
    reachedEnd.value = true
  } finally {
    loading.value = false
  }
}

function goToPage(target: number) {
  if (target < 0 || loading.value) return
  void runSearch(target)
}

async function toggleExpand(map: BeatSaverMapResponse) {
  if (expandedId.value === map.id) {
    expandedId.value = null
    return
  }
  expandedId.value = map.id
  const hash = map.versions[0]?.hash
  if (!hash || resolvedByHash.value.has(hash)) return
  resolvingHash.value = hash
  try {
    const index = await fetchMapLeaderboardIndex(hash)
    const next = new Map(resolvedByHash.value)
    next.set(hash, index)
    resolvedByHash.value = next
  } catch {
    const next = new Map(resolvedByHash.value)
    next.set(hash, { bl: new Map(), ss: new Map(), coverUrl: null })
    resolvedByHash.value = next
  } finally {
    resolvingHash.value = null
  }
}

function indexFor(map: BeatSaverMapResponse): MapLeaderboardIndex | null {
  const hash = map.versions[0]?.hash
  return hash ? (resolvedByHash.value.get(hash) ?? null) : null
}

function coverFor(map: BeatSaverMapResponse): string {
  return indexFor(map)?.coverUrl ?? map.versions[0]?.coverURL ?? ''
}

interface DiffRow {
  key: string
  difficulty: string
  characteristic: string
  njs: number
  nps: number | undefined
  blLeaderboardId: string | null
  ssLeaderboardId: string | null
  importable: boolean
}

function diffRowsFor(map: BeatSaverMapResponse): DiffRow[] {
  const index = indexFor(map)
  const diffs = map.versions[0]?.diffs ?? []
  return diffs.map((d) => {
    const key = `${d.difficulty}-${d.characteristic}`
    const blLeaderboardId = index?.bl.get(key) ?? null
    const ssRaw = index?.ss.get(key)
    const ssLeaderboardId = ssRaw != null ? String(ssRaw) : null
    return {
      key,
      difficulty: d.difficulty,
      characteristic: d.characteristic,
      njs: d.njs,
      nps: d.nps,
      blLeaderboardId,
      ssLeaderboardId,
      importable: !!blLeaderboardId && !!ssLeaderboardId,
    }
  })
}

function missingReason(row: DiffRow): string {
  if (!row.blLeaderboardId && !row.ssLeaderboardId) return 'Not on BeatLeader or ScoreSaber'
  if (!row.blLeaderboardId) return 'Not on BeatLeader'
  return 'Not on ScoreSaber'
}

async function importDiff(map: BeatSaverMapResponse, row: DiffRow) {
  if (!row.importable || !row.blLeaderboardId || !row.ssLeaderboardId) return
  const key = importKey(map.id, row.key)
  const existing = importStates.value.get(key)
  if (existing && (existing.status === 'importing' || existing.status === 'imported' || existing.status === 'attached')) {
    return
  }
  setImportState(key, { status: 'importing' })
  try {
    const { attached } = await props.submit({
      blLeaderboardId: row.blLeaderboardId,
      ssLeaderboardId: row.ssLeaderboardId,
    })
    setImportState(key, {
      status: attached ? 'attached' : 'imported',
      message: attached ? 'Already in system · attached' : undefined,
    })
  } catch (e) {
    const parsed = parseApiError(e, 'Import failed')
    setImportState(key, { status: 'error', message: parsed.message })
  }
}

function setImportState(key: string, state: ImportState) {
  const next = new Map(importStates.value)
  next.set(key, state)
  importStates.value = next
}

function importStateFor(map: BeatSaverMapResponse, row: DiffRow): ImportState | undefined {
  return importStates.value.get(importKey(map.id, row.key))
}

function actionLabel(state: ImportState | undefined): string {
  if (!state) return props.mode === 'repoint' ? 'Use this' : 'Add'
  if (state.status === 'importing') return '...'
  if (state.status === 'imported') return 'Imported'
  if (state.status === 'attached') return 'Attached'
  return 'Retry'
}

function resetFilters() {
  tags.value = ''
  leaderboard.value = 'All'
  aiFilter.value = 'exclude'
  minNps.value = null
  maxNps.value = null
  minBpm.value = null
  maxBpm.value = null
  minDuration.value = null
  maxDuration.value = null
  minRating.value = null
  maxRating.value = null
  flags.value = {
    chroma: false,
    noodle: false,
    cinema: false,
    curated: false,
    verified: false,
    fullSpread: false,
  }
}
</script>

<template>
  <div class="gms">
    <div class="gms__head">
      <input
        v-model="query"
        class="gms__search"
        type="search"
        autofocus
        placeholder="Search BeatSaver, or paste a code / URL (e.g. 52cc6)"
      />
      <div class="gms__order">
        <BaseSelect
          :model-value="order"
          :options="ORDER_OPTIONS"
          @update:model-value="order = $event as BeatSaverOrder"
        />
      </div>
      <FilterButton
        :active="filtersOpen || hasActiveFilters"
        :has-indicator="hasActiveFilters"
        @click="filtersOpen = !filtersOpen"
      />
    </div>

    <div v-if="filtersOpen" class="gms__filters">
      <div class="gms__filter-row">
        <label class="gms__field">
          <span>Leaderboard</span>
          <BaseSelect
            :model-value="leaderboard"
            :options="LEADERBOARD_OPTIONS"
            @update:model-value="leaderboard = $event as BeatSaverLeaderboardFilter"
          />
        </label>
        <label class="gms__field">
          <span>AI maps</span>
          <BaseSelect
            :model-value="aiFilter"
            :options="AI_OPTIONS"
            @update:model-value="aiFilter = $event as AiFilter"
          />
        </label>
        <label class="gms__field gms__field--wide">
          <span>Tags <small>(, = AND · | = OR · ! = exclude)</small></span>
          <input v-model="tags" type="text" placeholder="e.g. anime,!meme" />
        </label>
      </div>

      <div class="gms__filter-row">
        <label class="gms__field gms__field--range">
          <span>NPS</span>
          <div class="gms__range">
            <input v-model.number="minNps" type="number" min="0" step="0.1" placeholder="min" />
            <input v-model.number="maxNps" type="number" min="0" step="0.1" placeholder="max" />
          </div>
        </label>
        <label class="gms__field gms__field--range">
          <span>BPM</span>
          <div class="gms__range">
            <input v-model.number="minBpm" type="number" min="0" placeholder="min" />
            <input v-model.number="maxBpm" type="number" min="0" placeholder="max" />
          </div>
        </label>
        <label class="gms__field gms__field--range">
          <span>Duration (s)</span>
          <div class="gms__range">
            <input v-model.number="minDuration" type="number" min="0" placeholder="min" />
            <input v-model.number="maxDuration" type="number" min="0" placeholder="max" />
          </div>
        </label>
        <label class="gms__field gms__field--range">
          <span>Rating</span>
          <div class="gms__range">
            <input v-model.number="minRating" type="number" min="0" max="1" step="0.01" placeholder="min" />
            <input v-model.number="maxRating" type="number" min="0" max="1" step="0.01" placeholder="max" />
          </div>
        </label>
      </div>

      <div class="gms__flags">
        <label v-for="f in BOOLEAN_FLAGS" :key="f.key" class="gms__flag">
          <input v-model="flags[f.key]" type="checkbox" />
          <span>{{ f.label }}</span>
        </label>
        <button v-if="hasActiveFilters" type="button" class="gms__reset" @click="resetFilters">
          Reset filters
        </button>
      </div>
    </div>

    <p v-if="error" class="gms__error" role="alert">{{ error }}</p>

    <div class="gms__body">
      <div v-if="loading" class="gms__list">
        <SkeletonLoader v-for="i in 6" :key="i" variant="table-row" />
      </div>

      <p v-else-if="!canSearch" class="gms__empty">
        Type a search term to browse BeatSaver.
      </p>

      <p v-else-if="docs.length === 0" class="gms__empty">
        No BeatSaver maps match that search.
      </p>

      <ul v-else class="gms__list">
        <li v-for="map in docs" :key="map.id" class="gms__item">
          <button type="button" class="gms__row" @click="toggleExpand(map)">
            <span class="gms__cover">
              <img v-if="coverFor(map)" :src="coverFor(map)" :alt="map.metadata.songName" loading="lazy" />
            </span>
            <span class="gms__meta">
              <span class="gms__title">{{ map.metadata.songName }}</span>
              <span class="gms__sub">
                <span>{{ map.metadata.songAuthorName }}</span>
                <span class="gms__sep" aria-hidden="true">·</span>
                <span>{{ map.metadata.levelAuthorName }}</span>
              </span>
            </span>
            <span class="gms__badges">
              <span v-if="map.ranked || map.blRanked" class="gms__tag gms__tag--ranked">Ranked</span>
              <span v-if="map.automapper" class="gms__tag gms__tag--ai">AI</span>
              <code class="gms__code">{{ map.id }}</code>
              <svg
                class="gms__chevron"
                :class="{ 'gms__chevron--open': expandedId === map.id }"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </span>
          </button>

          <div v-if="expandedId === map.id" class="gms__diffs">
            <div v-if="resolvingHash === map.versions[0]?.hash" class="gms__diffs-loading">
              <SkeletonLoader v-for="i in 2" :key="i" variant="text" />
            </div>
            <template v-else>
              <p
                v-if="diffRowsFor(map).every((r) => !r.blLeaderboardId)"
                class="gms__diffs-none"
              >
                This map has no BeatLeader leaderboard and cannot be imported.
              </p>
              <div
                v-for="row in diffRowsFor(map)"
                :key="row.key"
                class="gms__diff"
                :class="{ 'gms__diff--disabled': !row.importable }"
              >
                <span class="gms__diff-name">
                  {{ formatBsDifficulty(row.difficulty) }}
                  <span v-if="row.characteristic !== 'Standard'" class="gms__diff-char">
                    {{ row.characteristic }}
                  </span>
                </span>
                <span class="gms__diff-meta">
                  NJS {{ row.njs }}<template v-if="row.nps != null"> · {{ row.nps.toFixed(1) }} NPS</template>
                </span>
                <span
                  v-if="!row.importable"
                  class="gms__diff-missing"
                  :title="missingReason(row)"
                >
                  {{ missingReason(row) }}
                </span>
                <span
                  v-else-if="importStateFor(map, row)?.message"
                  class="gms__diff-note"
                  :class="{ 'gms__diff-note--error': importStateFor(map, row)?.status === 'error' }"
                >
                  {{ importStateFor(map, row)?.message }}
                </span>
                <BaseButton
                  size="sm"
                  :variant="importStateFor(map, row)?.status === 'imported' || importStateFor(map, row)?.status === 'attached' ? 'default' : 'primary'"
                  :disabled="!row.importable || importStateFor(map, row)?.status === 'importing' || importStateFor(map, row)?.status === 'imported' || importStateFor(map, row)?.status === 'attached'"
                  :loading="importStateFor(map, row)?.status === 'importing'"
                  @click="importDiff(map, row)"
                >
                  {{ actionLabel(importStateFor(map, row)) }}
                </BaseButton>
              </div>
            </template>
          </div>
        </li>
      </ul>

      <div
        v-if="!loading && !isCodeResult && (page > 0 || (docs.length > 0 && !reachedEnd))"
        class="gms__pager"
      >
        <BaseButton size="sm" :disabled="page === 0" @click="goToPage(page - 1)">Prev</BaseButton>
        <span class="gms__page">Page {{ page + 1 }}</span>
        <BaseButton size="sm" :disabled="reachedEnd" @click="goToPage(page + 1)">Next</BaseButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gms {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  width: min(860px, 100%);
  max-height: min(78vh, 680px);
}

.gms__head {
  display: flex;
  align-items: stretch;
  gap: var(--space-sm);
  flex: 0 0 auto;
}

.gms__search {
  flex: 1 1 auto;
  min-width: 0;
  padding: 10px 12px;
  font-family: var(--font-sans);
  font-size: var(--text-body);
  color: var(--text-primary);
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
  outline: none;
  transition: border-color 120ms ease;
}

.gms__search:focus {
  border-color: var(--page-accent, var(--accent));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--page-accent, var(--accent)) 20%, transparent);
}

.gms__order {
  width: 150px;
  flex: 0 0 auto;
}

.gms__filters {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
}

.gms__filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
}

.gms__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 140px;
  min-width: 0;
}

.gms__field--wide {
  flex: 2 1 220px;
}

.gms__field--range {
  flex: 1 1 130px;
}

.gms__field > span {
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.gms__field > span small {
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
}

.gms__field input {
  width: 100%;
  padding: 7px 10px;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--text-primary);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
  outline: none;
}

.gms__field input:focus {
  border-color: var(--page-accent, var(--accent));
}

.gms__range {
  display: flex;
  gap: 6px;
}

.gms__flags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-md);
}

.gms__flag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  cursor: pointer;
}

.gms__reset {
  margin-left: auto;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
}

.gms__reset:hover {
  color: var(--error);
}

.gms__error {
  margin: 0;
  padding: 8px 10px;
  font-size: var(--text-caption);
  color: var(--error);
  background: color-mix(in srgb, var(--error) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--error) 35%, transparent);
  border-radius: 3px;
}

.gms__body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--bg-overlay) transparent;
}

.gms__empty {
  margin: var(--space-lg) 0;
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  text-align: center;
}

.gms__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.gms__item {
  border: 1px solid transparent;
  border-radius: 3px;
}

.gms__row {
  width: 100%;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  gap: var(--space-sm);
  align-items: center;
  padding: 8px;
  background: transparent;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  text-align: left;
  color: inherit;
  transition: background 120ms ease;
}

.gms__row:hover {
  background: var(--bg-elevated);
}

.gms__cover {
  width: 44px;
  height: 44px;
  border-radius: 3px;
  overflow: hidden;
  background: var(--bg-elevated);
  flex-shrink: 0;
}

.gms__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.gms__meta {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.gms__title {
  font-family: var(--font-sans);
  font-size: var(--text-body);
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gms__sub {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--text-caption);
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gms__sep {
  color: var(--text-tertiary);
}

.gms__badges {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
}

.gms__tag {
  font-family: var(--font-sans);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 3px;
}

.gms__tag--ranked {
  color: var(--info);
  background: color-mix(in srgb, var(--info) 14%, transparent);
}

.gms__tag--ai {
  color: var(--text-tertiary);
  border: 1px solid var(--bg-overlay);
}

.gms__code {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--text-tertiary);
}

.gms__chevron {
  color: var(--text-tertiary);
  transition: transform 150ms ease;
}

.gms__chevron--open {
  transform: rotate(180deg);
}

.gms__diffs {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 8px 10px 56px;
}

.gms__diffs-loading {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gms__diffs-none {
  margin: 4px 0;
  font-size: var(--text-caption);
  color: var(--error);
}

.gms__diff {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--space-sm);
  padding: 6px 8px;
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
}

.gms__diff--disabled {
  opacity: 0.6;
}

.gms__diff-name {
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--text-primary);
}

.gms__diff-char {
  font-weight: 400;
  color: var(--text-tertiary);
  margin-left: 4px;
}

.gms__diff-meta {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--text-tertiary);
  justify-self: end;
}

.gms__diff-missing {
  grid-column: 1 / -1;
  font-size: 0.6875rem;
  color: var(--text-tertiary);
}

.gms__diff-note {
  grid-column: 1 / 2;
  font-size: 0.6875rem;
  color: var(--success);
}

.gms__diff-note--error {
  color: var(--error);
}

.gms__pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  padding: var(--space-sm) 0;
}

.gms__page {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}
</style>
