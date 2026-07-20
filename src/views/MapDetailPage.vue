<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import BaseTabs from '@/components/common/BaseTabs.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import StatBlock from '@/components/common/StatBlock.vue'
import ApTweaker from '@/components/domain/ApTweaker.vue'
import ComplexityBadge from '@/components/domain/ComplexityBadge.vue'
import DifficultyBadge from '@/components/domain/DifficultyBadge.vue'
import { useColorExtract } from '@/composables/useColorExtract'
import { usePageMeta } from '@/composables/usePageMeta'
import { useCategoryStore } from '@/stores/categories'
import { useThemeStore } from '@/stores/theme'
import type { MapDifficultyStatisticsResponse, PublicMapDifficultyResponse, PublicMapResponse } from '@/types/api/maps'
import type { DifficultyScoreDisplay } from '@/types/display'
import { brightenRgb } from '@/utils/color'
import { DIFFICULTY_ORDER } from '@/utils/constants'
import { formatDifficulty } from '@/utils/mappers'
import { buildMapRoute, isUuid, slugToDifficulty } from '@/utils/mapRoute'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MapScoresSection from './maps/MapScoresSection.vue'
import MapStatisticsSection from './maps/MapStatisticsSection.vue'

const route = useRoute()
const router = useRouter()
const themeStore = useThemeStore()
const categoryStore = useCategoryStore()

const map = ref<PublicMapResponse | null>(null)
const activeDifficultyId = ref<string>('')
const diffStats = ref<MapDifficultyStatisticsResponse | null>(null)
const topScoresFirstPage = ref<DifficultyScoreDisplay[]>([])

const routeParam = computed(() => route.params.mapId as string)

function onTopScoresLoaded(scores: DifficultyScoreDisplay[]) {
  topScoresFirstPage.value = scores
}
const loading = ref(true)
const error = ref(false)

const activeTab = ref('leaderboard')
const contentTabs = [
  { key: 'leaderboard', label: 'Leaderboard' },
  { key: 'statistics', label: 'Statistics' },
]

const coverUrl = computed(() => map.value?.cdnCoverUrl ?? map.value?.coverUrl ?? '')
const coverFallbackUrl = computed(() => {
  const m = map.value
  if (!m) return null
  return m.cdnCoverUrl && m.coverUrl && m.cdnCoverUrl !== m.coverUrl ? m.coverUrl : null
})
const { dominantColor } = useColorExtract(coverUrl)
const handleMapCoverError = (e: Event) => {
  const img = e.currentTarget as HTMLImageElement
  const fb = coverFallbackUrl.value
  if (fb && img.src !== fb && img.dataset.fellBack !== '1') {
    img.dataset.fellBack = '1'
    img.src = fb
  }
}

const resolvedAccent = computed(() => {
  const raw = dominantColor.value
  if (!raw) return categoryAccent.value
  return themeStore.resolvedBase === 'dark' ? brightenRgb(raw, 60) : raw
})

const rankedDifficulties = computed<PublicMapDifficultyResponse[]>(() => {
  if (!map.value) return []
  return map.value.difficulties
    .filter((d) => d.status === 'RANKED')
    .sort((a, b) => DIFFICULTY_ORDER.indexOf(a.difficulty) - DIFFICULTY_ORDER.indexOf(b.difficulty))
})

const activeDifficulty = computed(() =>
  map.value?.difficulties.find((d) => d.id === activeDifficultyId.value) ?? null
)

const isActiveDifficultyRanked = computed(() => activeDifficulty.value?.status === 'RANKED')

const showApStats = computed(() => {
  const status = activeDifficulty.value?.status
  return status !== 'CAMPAIGN' && status !== 'QUEUE'
})

const hasCategory = computed(() => activeDifficulty.value?.categoryId != null)

const categoryCode = computed(() => {
  if (!activeDifficulty.value) return 'overall'
  return categoryStore.getCategoryCode(activeDifficulty.value.categoryId) ?? 'overall'
})

const categoryAccent = computed(() => categoryStore.getAccent(categoryCode.value))

const categoryName = computed(() => {
  const info = categoryStore.getCategoryInfo(categoryCode.value)
  return info?.name ?? categoryCode.value
})

const scoreCurveId = computed(() => categoryStore.byCode.get(categoryCode.value)?.scoreCurve?.id)
const tweakerOpen = ref(false)
const tweakerAnchor = ref<HTMLElement | null>(null)

function toggleMapTweaker(event: Event) {
  tweakerOpen.value = !tweakerOpen.value
  tweakerAnchor.value = tweakerOpen.value ? (event.currentTarget as HTMLElement) : null
}

const bsrCopied = ref(false)
let bsrCopiedTimer: ReturnType<typeof setTimeout> | null = null

async function copyBsr() {
  if (!map.value?.beatsaverCode) return
  const text = `!bsr ${map.value.beatsaverCode}`
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
  bsrCopied.value = true
  if (bsrCopiedTimer) clearTimeout(bsrCopiedTimer)
  bsrCopiedTimer = setTimeout(() => { bsrCopied.value = false }, 1400)
}

const difficultyTabs = computed(() =>
  rankedDifficulties.value.map((d) => ({
    key: d.id,
    label: formatDifficulty(d.difficulty),
  }))
)

const breadcrumbs = computed(() => [
  { label: 'Maps', to: '/maps' },
  { label: map.value?.songName ?? 'Map' },
])

const metaTitle = computed(() => {
  if (!map.value) return undefined
  return `${map.value.songAuthor} - ${map.value.songName} | AccSaber`
})

usePageMeta({ title: metaTitle })

function goToPlayer(userId: string) {
  window.open(router.resolve({ name: 'player-profile', params: { userId } }).href, '_self')
}

function resolveQueryDifficulty(
  difficulties: PublicMapDifficultyResponse[],
): PublicMapDifficultyResponse | null {
  const queryDiffId = route.query.difficultyId as string | undefined
  if (queryDiffId) {
    return difficulties.find((d) => d.id === queryDiffId) ?? null
  }
  const queryDifficulty = route.query.difficulty as string | undefined
  if (!queryDifficulty) return null
  const targetEnum = slugToDifficulty(queryDifficulty)
  const targetChar = ((route.query.characteristic as string | undefined) ?? 'Standard').toLowerCase()
  return (
    difficulties.find(
      (d) => d.difficulty === targetEnum && d.characteristic.toLowerCase() === targetChar,
    ) ?? null
  )
}

async function fetchMap() {
  loading.value = true
  error.value = false
  map.value = null

  try {
    const { getMap, getMapByCode } = await import('@/api/maps')
    if (isUuid(routeParam.value)) {
      map.value = await getMap(routeParam.value)
    } else {
      const qDifficulty = route.query.difficulty as string | undefined
      const byCodeParams: { difficulty?: string; characteristic?: string } = {}
      if (qDifficulty) {
        byCodeParams.difficulty = slugToDifficulty(qDifficulty)
        byCodeParams.characteristic = (route.query.characteristic as string | undefined) ?? 'Standard'
      }
      map.value = await getMapByCode(routeParam.value, byCodeParams)
    }

    const all = map.value.difficulties
    const ranked = all
      .filter((d) => d.status === 'RANKED')
      .sort((a, b) => DIFFICULTY_ORDER.indexOf(a.difficulty) - DIFFICULTY_ORDER.indexOf(b.difficulty))
    const matched = resolveQueryDifficulty(all)
    if (matched) {
      activeDifficultyId.value = matched.id
    } else if (ranked.length > 0) {
      activeDifficultyId.value = ranked[0].id
    } else if (all.length > 0) {
      activeDifficultyId.value = all[0].id
    }
  } catch {
    error.value = true
  }
  loading.value = false
}

watch(() => [route.query.difficultyId, route.query.difficulty, route.query.characteristic], () => {
  if (!map.value) return
  const matched = resolveQueryDifficulty(map.value.difficulties)
  if (matched) {
    if (matched.id !== activeDifficultyId.value) {
      activeDifficultyId.value = matched.id
    }
    return
  }
  if (!isUuid(routeParam.value)) fetchMap()
})

async function fetchDifficultyStats() {
  if (!activeDifficultyId.value) return
  try {
    const { getDifficultyStatistics } = await import('@/api/maps')
    diffStats.value = await getDifficultyStatistics(activeDifficultyId.value)
  } catch {
    diffStats.value = null
  }
}

watch(routeParam, () => fetchMap(), { immediate: true })

watch(activeDifficultyId, (newId) => {
  if (!newId || !map.value) return
  topScoresFirstPage.value = []
  fetchDifficultyStats()

  const diff = map.value.difficulties.find((d) => d.id === newId)
  if (!diff) return

  const target = buildMapRoute({
    beatsaverCode: map.value.beatsaverCode,
    mapId: map.value.id,
    difficulty: diff.difficulty,
    difficultyId: diff.id,
    characteristic: diff.characteristic,
  }) as { path: string; query: Record<string, string> }

  if (target.path !== route.path || !sameQuery(target.query, route.query)) {
    router.replace(target)
  }
})

function sameQuery(a: Record<string, string>, b: Record<string, unknown>): boolean {
  const aKeys = Object.keys(a)
  if (aKeys.length !== Object.keys(b).length) return false
  return aKeys.every((k) => a[k] === b[k])
}
</script>

<template>
  <div class="map-detail" :style="{ '--page-accent': resolvedAccent }">
    <template v-if="loading">
      <div class="map-detail__skeleton">
        <SkeletonLoader variant="avatar" width="120px" height="120px" />
        <SkeletonLoader variant="text" width="300px" />
        <SkeletonLoader variant="text" width="200px" />
        <div class="map-detail__skeleton-stats">
          <SkeletonLoader v-for="i in 4" :key="i" variant="stat-block" />
        </div>
      </div>
    </template>

    <template v-else-if="error || !map">
      <h1 class="map-detail__error-title">Map Not Found</h1>
      <p class="map-detail__error">Could not load this map.</p>
    </template>

    <template v-else>
      <nav class="map-detail__breadcrumbs" aria-label="Breadcrumb">
        <span class="map-detail__breadcrumbs-pill">
          <router-link v-for="(crumb, i) in breadcrumbs" :key="i" :to="crumb.to ?? ''" class="map-detail__crumb"
            :class="{ 'map-detail__crumb--link': !!crumb.to }">
            {{ crumb.label }}
            <span v-if="i < breadcrumbs.length - 1" class="map-detail__crumb-sep">/</span>
          </router-link>
        </span>
      </nav>

      <div class="map-detail__bg">
        <div class="map-detail__bg-image" :style="{ backgroundImage: `url(${coverUrl})` }" />
      </div>

      <div class="map-detail__hero">
        <div class="map-detail__cover-wrap">
          <img class="map-detail__cover" :src="coverUrl" :alt="map.songName" fetchpriority="high" decoding="async"
            @error="handleMapCoverError" />
        </div>

        <div class="map-detail__details">
          <div class="map-detail__name-row">
            <h1 class="map-detail__song">{{ map.songName }}</h1>
          </div>
          <p class="map-detail__artist">{{ map.songAuthor }}</p>
          <p class="map-detail__mapper">Mapped by <strong>{{ map.mapAuthor }}</strong></p>

          <div class="map-detail__links">
            <BaseButton v-if="map.beatsaverCode" size="sm" :href="`beatsaver://${map.beatsaverCode}`"
              aria-label="One-Click Install" title="One-Click Install">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M8 13V4.5a1.5 1.5 0 0 1 3 0V12" />
                <path d="M11 11.5V6.5a1.5 1.5 0 0 1 3 0V12" />
                <path d="M14 10.5V8.5a1.5 1.5 0 0 1 3 0V13a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6v-2a1.5 1.5 0 0 1 3 0V12" />
              </svg>
            </BaseButton>
            <BaseButton v-if="map.beatsaverCode" size="sm" :href="`https://beatsaver.com/maps/${map.beatsaverCode}`"
              aria-label="View on BeatSaver">
              <img src="https://beatsaver.com/static/favicon/favicon-32x32.png" alt="BeatSaver" width="16" height="16"
                style="border-radius: 3px;" decoding="async" />
            </BaseButton>
            <BaseButton v-if="map.beatsaverCode" size="sm" aria-label="Copy BSR" title="Copy BSR"
              class="map-detail__bsr-btn" @click="copyBsr">
              <span v-if="bsrCopied" class="map-detail__bsr-label">Copied!</span>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="14" />
                <line x1="12" y1="18" x2="12" y2="19" />
              </svg>
            </BaseButton>
            <BaseButton v-if="activeDifficulty?.blLeaderboardId" size="sm"
              :href="`https://www.beatleader.com/leaderboard/global/${activeDifficulty.blLeaderboardId}`"
              aria-label="View on BeatLeader">
              <img src="https://beatleader.com/assets/favicon-32x32.png" alt="BeatLeader" width="16" height="16"
                style="border-radius: 3px;" decoding="async" />
            </BaseButton>
            <BaseButton v-if="activeDifficulty?.ssLeaderboardId" size="sm"
              :href="`https://scoresaber.com/leaderboard/${activeDifficulty.ssLeaderboardId}`"
              aria-label="View on ScoreSaber">
              <img src="https://scoresaber.com/favicon-32x32.png" alt="ScoreSaber" width="16" height="16"
                style="border-radius: 3px;" decoding="async" />
            </BaseButton>
            <BaseButton v-if="scoreCurveId && activeDifficulty && isActiveDifficultyRanked" size="sm" aria-label="AP Tweaker"
              @click="toggleMapTweaker($event)">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" stroke="currentColor" stroke-width="1.5"
                  stroke-linecap="round" stroke-linejoin="round" />
                <path
                  d="M16.2 12.5a1.4 1.4 0 00.28 1.54l.05.05a1.7 1.7 0 11-2.4 2.4l-.05-.05a1.4 1.4 0 00-1.54-.28 1.4 1.4 0 00-.84 1.28v.14a1.7 1.7 0 11-3.4 0v-.07a1.4 1.4 0 00-.92-1.28 1.4 1.4 0 00-1.54.28l-.05.05a1.7 1.7 0 11-2.4-2.4l.05-.05a1.4 1.4 0 00.28-1.54 1.4 1.4 0 00-1.28-.84H2.3a1.7 1.7 0 110-3.4h.07a1.4 1.4 0 001.28-.92 1.4 1.4 0 00-.28-1.54l-.05-.05a1.7 1.7 0 112.4-2.4l.05.05a1.4 1.4 0 001.54.28h.07a1.4 1.4 0 00.84-1.28V2.3a1.7 1.7 0 113.4 0v.07a1.4 1.4 0 00.84 1.28 1.4 1.4 0 001.54-.28l.05-.05a1.7 1.7 0 112.4 2.4l-.05.05a1.4 1.4 0 00-.28 1.54v.07a1.4 1.4 0 001.28.84h.14a1.7 1.7 0 110 3.4h-.07a1.4 1.4 0 00-1.28.84z"
                  stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </BaseButton>
            <ApTweaker v-if="scoreCurveId && activeDifficulty && isActiveDifficultyRanked" :open="tweakerOpen" :curve-id="scoreCurveId"
              :anchor-el="tweakerAnchor" :complexity="activeDifficulty.complexity ?? undefined" :show-weighted="false"
              @update:open="(val: boolean) => { tweakerOpen = val; if (!val) tweakerAnchor = null }" />
          </div>

          <BaseTabs v-if="difficultyTabs.length > 1" :tabs="difficultyTabs" :model-value="activeDifficultyId"
            @update:model-value="activeDifficultyId = $event" />

          <div v-if="activeDifficulty" class="map-detail__stats-strip">
            <div class="map-detail__diff-meta">
              <DifficultyBadge :difficulty="activeDifficulty.difficulty" />
              <ComplexityBadge v-if="isActiveDifficultyRanked" :complexity="activeDifficulty.complexity ?? 0" bar />
              <span v-if="hasCategory" class="map-detail__category-name" :style="{ color: categoryAccent }">{{ categoryName }}</span>
            </div>
            <div v-if="showApStats" class="map-detail__stats">
              <StatBlock label="Max AP" :value="diffStats?.maxAp?.toFixed(2) ?? '-'" />
              <StatBlock label="Min AP" :value="diffStats?.minAp?.toFixed(2) ?? '-'" />
              <StatBlock label="Avg AP" :value="diffStats?.averageAp?.toFixed(2) ?? '-'" />
              <StatBlock label="Total Scores" :value="diffStats?.totalScores ?? 0" :decimals="0" />
            </div>
          </div>
        </div>
      </div>

      <BaseTabs v-if="isActiveDifficultyRanked" :tabs="contentTabs" :model-value="activeTab" @update:model-value="activeTab = $event" />

      <div v-if="isActiveDifficultyRanked" class="map-detail__content">
        <div v-show="activeTab === 'leaderboard'">
          <MapScoresSection v-if="activeDifficultyId" :difficulty-id="activeDifficultyId" :map-id="map?.id"
            :map-name="map?.songName" :artist-name="map?.songAuthor" :map-author="map?.mapAuthor"
            :cover-url="coverUrl" :cover-fallback-url="coverFallbackUrl" :category-code="categoryCode"
            :difficulty="activeDifficulty ? formatDifficulty(activeDifficulty.difficulty) : undefined"
            :complexity="activeDifficulty?.complexity ?? null"
            :accent-color="resolvedAccent" @top-scores-loaded="onTopScoresLoaded" />
        </div>

        <MapStatisticsSection v-if="activeTab === 'statistics' && activeDifficultyId"
          :difficulty-id="activeDifficultyId" :map-id="map.id" :accent-color="resolvedAccent"
          :top-scores-first-page="topScoresFirstPage" @navigate-player="goToPlayer" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.map-detail {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-lg);
  --accent: var(--page-accent, var(--accent-overall));
}

.map-detail>*:not(.map-detail__bg) {
  width: 100%;
  max-width: 1100px;
  position: relative;
  z-index: 1;
}

.map-detail__bg {
  position: absolute;
  top: calc(-1 * var(--space-xl));
  left: calc(-1 * var(--space-xl));
  right: calc(-1 * var(--space-xl));
  height: 75vh;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  -webkit-mask-image: linear-gradient(to bottom, black 50%, transparent 100%);
  mask-image: linear-gradient(to bottom, black 50%, transparent 100%);
}

.map-detail__bg-image {
  position: absolute;
  inset: -80px;
  background-size: cover;
  background-position: center 20%;
  background-repeat: no-repeat;
  filter: blur(40px);
  opacity: 0.3;
}

.map-detail__breadcrumbs {
  display: flex;
}

.map-detail__breadcrumbs-pill {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-pill);
}

.map-detail__crumb {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  text-decoration: none;
}

.map-detail__crumb--link {
  color: var(--text-primary);
  transition: color 120ms ease;
}

.map-detail__crumb--link:hover {
  color: var(--accent);
}

.map-detail__crumb-sep {
  margin-left: var(--space-xs);
  color: var(--text-secondary);
}

.map-detail__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xl);
  padding: var(--space-xl) var(--space-lg);
  text-align: center;
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
}

.map-detail__cover-wrap {
  position: relative;
  width: 120px;
  height: 120px;
  flex-shrink: 0;
}

.map-detail__cover {
  width: 120px;
  height: 120px;
  border-radius: var(--radius-avatar);
  object-fit: cover;
  border: 1px solid var(--bg-overlay);
}

.map-detail__details {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  width: 100%;
  min-width: 0;
}

.map-detail__name-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
}

.map-detail__song {
  font-size: var(--text-page-title);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.map-detail__artist {
  font-size: var(--text-body);
  color: var(--text-secondary);
  margin: 0;
}

.map-detail__mapper {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  margin: 0;
}

.map-detail__mapper strong {
  color: var(--text-secondary);
  font-weight: 500;
}

.map-detail__links {
  display: flex;
  gap: var(--space-sm);
}

.map-detail__bsr-label {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  letter-spacing: 0.02em;
}

.map-detail__stats-strip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
}

.map-detail__diff-meta {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.map-detail__category-name {
  font-size: var(--text-body);
  font-weight: 600;
}

.map-detail__stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-sm);
}

.map-detail__content {
  min-height: 400px;
}

.map-detail__error-title {
  font-size: var(--text-page-title);
  font-weight: 700;
  color: var(--text-primary);
  text-align: center;
}

.map-detail__error {
  text-align: center;
  color: var(--text-secondary);
  padding: var(--space-3xl);
}

.map-detail__skeleton {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-xl) var(--space-lg);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
}

.map-detail__skeleton-stats {
  display: flex;
  justify-content: center;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
}

@media (max-width: 767px) {
  .map-detail__bg {
    top: calc(-1 * var(--space-md));
    left: calc(-1 * var(--space-md));
    right: calc(-1 * var(--space-md));
  }

  .map-detail__cover-wrap {
    width: 96px;
    height: 96px;
  }

  .map-detail__cover {
    width: 96px;
    height: 96px;
  }

  .map-detail__stats {
    justify-content: center;
  }

  .map-detail__diff-meta {
    flex-wrap: wrap;
    justify-content: center;
  }

}
</style>
