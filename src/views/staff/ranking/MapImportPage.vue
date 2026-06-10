<script setup lang="ts">
import { ApiError } from '@/api/client'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import GlowImage from '@/components/common/GlowImage.vue'
import { useColorExtract } from '@/composables/useColorExtract'
import { usePageMeta } from '@/composables/usePageMeta'
import { rankingDashboardRoute } from '@/router'
import { useCategoryStore } from '@/stores/categories'
import type { Difficulty } from '@/types/enums'
import {
  type BeatSaverMapResponse,
  difficultyToEnum,
  fetchBeatLeaderLeaderboards,
  fetchBeatSaverMap,
  fetchScoreSaberLeaderboards,
  formatBsDifficulty,
  parseBeatSaverCode,
} from '@/utils/beatsaver'
import { brightenRgb } from '@/utils/color'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const categoryStore = useCategoryStore()

usePageMeta({
  title: 'Import Map | AccSaber Ranking',
  description: 'Import a map from BeatSaver into the AccSaber ranking queue.',
})

const input = ref('')
const fetchError = ref('')
const fetchLoading = ref(false)
const bsMap = ref<BeatSaverMapResponse | null>(null)

const coverUrl = computed(() => bsMap.value?.versions[0]?.coverURL ?? '')
const { dominantColor } = useColorExtract(coverUrl)

const pageAccent = computed(() => {
  if (!dominantColor.value) return undefined
  return brightenRgb(dominantColor.value, 60)
})

interface DiffSelection {
  characteristic: string
  difficulty: string
  njs: number
  notes: number
  selected: boolean
  categoryId: string
  blLeaderboardId: string | null
  ssLeaderboardId: number | null
  importing: boolean
  imported: boolean
  importError: string
  importedDifficultyId: string | null
}

const diffSelections = ref<DiffSelection[]>([])

const selectableCategories = computed(() =>
  categoryStore.categories.filter((c) => c.code !== 'overall'),
)

const categoryOptions = computed(() =>
  selectableCategories.value.map((c) => ({ value: c.id, label: c.name })),
)

const hasSelections = computed(() => diffSelections.value.some((d) => d.selected))
const allImported = computed(() =>
  diffSelections.value.filter((d) => d.selected).every((d) => d.imported)
)
const isImporting = computed(() => diffSelections.value.some((d) => d.importing))

async function handleFetch() {
  const code = parseBeatSaverCode(input.value)
  if (!code) {
    fetchError.value = 'Invalid BeatSaver code or URL.'
    return
  }

  fetchLoading.value = true
  fetchError.value = ''
  bsMap.value = null
  diffSelections.value = []

  try {
    const map = await fetchBeatSaverMap(code)
    bsMap.value = map

    const hash = map.versions[0]?.hash ?? ''
    const [blMap, ssMap] = await Promise.all([
      fetchBeatLeaderLeaderboards(hash),
      fetchScoreSaberLeaderboards(hash),
    ])

    const diffs = map.versions[0]?.diffs ?? []
    diffSelections.value = diffs.map((d) => {
      const key = `${d.difficulty}-${d.characteristic}`
      return {
        characteristic: d.characteristic,
        difficulty: d.difficulty,
        njs: d.njs,
        notes: d.notes,
        selected: false,
        categoryId: selectableCategories.value[0]?.id ?? '',
        blLeaderboardId: blMap.get(key) ?? null,
        ssLeaderboardId: ssMap.get(key) ?? null,
        importing: false,
        imported: false,
        importError: '',
        importedDifficultyId: null,
      }
    })
  } catch {
    fetchError.value = 'Map not found. Check the code and try again.'
  } finally {
    fetchLoading.value = false
  }
}

function extractApiErrorMessage(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.message === 'string') return parsed.message
  } catch {
  }
  return null
}

async function handleSubmit() {
  if (!bsMap.value) return

  const selected = diffSelections.value.filter((d) => d.selected)
  const { importMap } = await import('@/api/ranking/maps')
  const { castVote } = await import('@/api/ranking/voting')

  for (const diff of selected) {
    diff.importing = true
    diff.importError = ''
    try {
      if (!diff.blLeaderboardId || !diff.ssLeaderboardId) {
        throw new Error('Missing leaderboard IDs. BeatLeader or ScoreSaber may not have this difficulty.')
      }
      const result = await importMap({
        blLeaderboardId: diff.blLeaderboardId,
        ssLeaderboardId: String(diff.ssLeaderboardId),
        categoryId: diff.categoryId,
        difficulty: difficultyToEnum(diff.difficulty) as Difficulty,
        characteristic: diff.characteristic,
      })
      diff.imported = true
      diff.importedDifficultyId = result.id
      try {
        await castVote(result.id, { vote: 'UPVOTE', type: 'RANK' })
      } catch {
      }
    } catch (e) {
      if (e instanceof ApiError) {
        diff.importError = extractApiErrorMessage(e.message) ?? `Import failed (${e.status}).`
      } else {
        diff.importError = e instanceof Error ? e.message : 'Import failed'
      }
    } finally {
      diff.importing = false
    }
  }
}

function goToDashboard() {
  router.push({ name: rankingDashboardRoute })
}

function goToDetail(difficultyId: string) {
  router.push({ name: 'ranking-map-detail', params: { difficultyId } })
}
</script>

<template>
  <div class="map-import">
    <h1 class="map-import__title">Import Map</h1>

    <div class="map-import__input-row">
      <BaseInput v-model="input" placeholder="BeatSaver code or URL (e.g. 4fdd2)" :disabled="fetchLoading"
        @keydown.enter="handleFetch" />
      <BaseButton variant="primary" :loading="fetchLoading" :disabled="!input.trim()" @click="handleFetch">
        Fetch
      </BaseButton>
    </div>

    <div v-if="fetchError" class="map-import__error">
      {{ fetchError }}
    </div>

    <div v-if="bsMap" class="map-import__preview" :style="pageAccent ? { '--page-accent': pageAccent } : {}">
      <div class="map-import__hero">
        <GlowImage :src="coverUrl" alt="" :size="96" />
        <div class="map-import__hero-info">
          <h2 class="map-import__song-name">{{ bsMap.metadata.songName }}</h2>
          <p v-if="bsMap.metadata.songSubName" class="map-import__song-sub">{{ bsMap.metadata.songSubName }}</p>
          <p class="map-import__song-meta">
            {{ bsMap.metadata.songAuthorName }} - Mapped by {{ bsMap.metadata.levelAuthorName }}
          </p>
          <p class="map-import__song-stats">
            {{ bsMap.metadata.bpm }} BPM - {{ Math.floor(bsMap.metadata.duration / 60) }}:{{
              String(bsMap.metadata.duration % 60).padStart(2, '0') }}
          </p>
        </div>
      </div>

      <div class="map-import__diffs">
        <h3 class="map-import__section-title">Difficulties</h3>

        <div class="map-import__diff-list">
          <div class="map-import__diff-header">
            <span class="map-import__diff-col map-import__diff-col--name">Difficulty</span>
            <span class="map-import__diff-col map-import__diff-col--cat">Category</span>
          </div>
          <div v-for="diff in diffSelections" :key="`${diff.characteristic}-${diff.difficulty}`"
            class="map-import__diff-row" :class="{
              'map-import__diff-row--selected': diff.selected,
              'map-import__diff-row--imported': diff.imported,
              'map-import__diff-row--clickable': !diff.imported && !isImporting,
            }" @click="!diff.imported && !isImporting && (diff.selected = !diff.selected)">
            <div class="map-import__diff-col map-import__diff-col--name">
              <span class="map-import__diff-name">
                {{ formatBsDifficulty(diff.difficulty) }}
                <span v-if="diff.characteristic !== 'Standard'" class="map-import__diff-char">{{ diff.characteristic
                  }}</span>
              </span>
              <span class="map-import__diff-meta">
                NJS {{ diff.njs }} - {{ diff.notes }} notes
                <span v-if="!diff.blLeaderboardId || !diff.ssLeaderboardId" class="map-import__diff-warn">
                  {{ !diff.blLeaderboardId ? 'No BL ID' : '' }}{{ !diff.blLeaderboardId && !diff.ssLeaderboardId ? ', '
                  : '' }}{{ !diff.ssLeaderboardId ? 'No SS ID' : '' }}
                </span>
              </span>
            </div>

            <div class="map-import__diff-col map-import__diff-col--cat" @click.stop>
              <BaseSelect v-if="diff.selected && !diff.imported" v-model="diff.categoryId" :options="categoryOptions"
                :disabled="isImporting" />
            </div>

            <div v-if="diff.imported" class="map-import__diff-status map-import__diff-status--success">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Imported
              <BaseButton size="sm" @click.stop="goToDetail(diff.importedDifficultyId!)">View</BaseButton>
            </div>

            <div v-if="diff.importing" class="map-import__diff-status">
              Importing...
            </div>

            <div v-if="diff.importError" class="map-import__diff-status map-import__diff-status--error">
              {{ diff.importError }}
            </div>
          </div>
        </div>
      </div>

      <div class="map-import__actions">
        <BaseButton v-if="!allImported" variant="primary" size="lg" :loading="isImporting" :disabled="!hasSelections"
          @click="handleSubmit">
          Import Selected
        </BaseButton>
        <BaseButton v-else @click="goToDashboard">
          Back to Queue
        </BaseButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.map-import {
  max-width: 800px;
  margin: 0 auto;
  padding: var(--space-xl) var(--space-xl) var(--space-3xl);
}

.map-import__title {
  margin-bottom: var(--space-xl);
  font-size: var(--text-page-title);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.map-import__input-row {
  display: flex;
  gap: var(--space-sm);
  align-items: flex-end;
  margin-bottom: var(--space-lg);
}

.map-import__input-row> :first-child {
  flex: 1;
}

.map-import__error {
  padding: var(--space-sm) var(--space-md);
  background: color-mix(in srgb, var(--error) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--error) 25%, transparent);
  border-radius: var(--radius-btn);
  color: var(--error);
  font-size: var(--text-caption);
  margin-bottom: var(--space-lg);
}

.map-import__preview {
  position: relative;
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  background: var(--bg-surface);
}

.map-import__hero {
  position: relative;
  z-index: 1;
  display: flex;
  gap: var(--space-lg);
  padding: var(--space-xl);
  align-items: center;
}

.map-import__hero-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.map-import__song-name {
  font-size: var(--text-section);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.map-import__song-sub {
  font-size: var(--text-body);
  color: var(--text-secondary);
  margin: 0;
}

.map-import__song-meta {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  margin: 0;
}

.map-import__song-stats {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  margin: 0;
}

.map-import__diffs {
  position: relative;
  z-index: 1;
  padding: 0 var(--space-xl) var(--space-lg);
}

.map-import__section-title {
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0 0 var(--space-md);
}

.map-import__diff-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.map-import__diff-header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: 0 var(--space-md);
}

.map-import__diff-header .map-import__diff-col {
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.map-import__diff-col--name {
  flex: 1;
  min-width: 0;
}

.map-import__diff-col--cat {
  width: 160px;
  flex-shrink: 0;
}

.map-import__diff-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-btn);
  background: var(--bg-elevated);
  border: 2px solid transparent;
  transition: border-color 120ms ease, background 120ms ease;
}

.map-import__diff-row--clickable {
  cursor: pointer;
}

.map-import__diff-row--clickable:hover {
  background: var(--bg-overlay);
}

.map-import__diff-row--selected {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 5%, var(--bg-elevated));
}

.map-import__diff-row--imported {
  border-color: color-mix(in srgb, var(--success) 30%, transparent);
  opacity: 0.8;
  cursor: default;
}

.map-import__diff-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: var(--text-body);
}

.map-import__diff-char {
  font-weight: 400;
  color: var(--text-tertiary);
  font-size: var(--text-caption);
  margin-left: var(--space-xs);
}

.map-import__diff-meta {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  font-family: var(--font-mono);
}

.map-import__diff-warn {
  color: var(--error);
  font-weight: 600;
}

.map-import__diff-status {
  margin-left: auto;
  font-size: var(--text-caption);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.map-import__diff-status--success {
  color: var(--success);
}

.map-import__diff-status--error {
  color: var(--error);
}

.map-import__actions {
  position: relative;
  z-index: 1;
  padding: 0 var(--space-xl) var(--space-xl);
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 767px) {
  .map-import {
    padding: var(--space-md) var(--space-md) var(--space-2xl);
  }

  .map-import__hero {
    flex-direction: column;
    align-items: flex-start;
    padding: var(--space-md);
  }

  .map-import__diff-header {
    display: none;
  }

  .map-import__diff-row {
    flex-wrap: wrap;
  }

  .map-import__diff-col--cat {
    width: auto;
    flex: 1;
  }
}
</style>
