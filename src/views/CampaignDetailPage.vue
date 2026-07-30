<script setup lang="ts">
import {
  abandonCampaign,
  getCampaignByIdOrSlug,
  getMyCampaignProgress,
  getPlaylistExportUrl,
  startCampaign,
} from '@/api/campaigns'
import { ApiError, getApiErrorMessage } from '@/api/client'
import BaseButton from '@/components/common/BaseButton.vue'
import Breadcrumbs, { type Crumb } from '@/components/common/Breadcrumbs.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import CampaignCategoryTags from '@/components/domain/CampaignCategoryTags.vue'
import CampaignCurationCredits from '@/components/domain/CampaignCurationCredits.vue'
import CampaignModifierBadges from '@/components/domain/CampaignModifierBadges.vue'
import CampaignRoadmap from '@/components/domain/CampaignRoadmap.vue'
import CampaignRewardItem from '@/components/domain/CampaignRewardItem.vue'
import CampaignStatusBadge from '@/components/domain/CampaignStatusBadge.vue'
import CampaignVoteControl from '@/components/domain/CampaignVoteControl.vue'
import CountryFlag from '@/components/domain/CountryFlag.vue'
import CampaignLeaderboardTray from '@/views/campaign/CampaignLeaderboardTray.vue'
import CampaignRewardNotice from '@/views/campaign/CampaignRewardNotice.vue'
import ComplexityBadge from '@/components/domain/ComplexityBadge.vue'
import DifficultyBadge from '@/components/domain/DifficultyBadge.vue'
import MapChartStats from '@/components/domain/MapChartStats.vue'
import {
  onAvatarError,
  pickAvatarFallback,
  pickAvatarUrl,
  pickCoverUrl,
} from '@/composables/useAvatarFallback'
import { useItemCatalog } from '@/composables/useItemCatalog'
import { usePageMeta } from '@/composables/usePageMeta'
import { useAuthStore } from '@/stores/auth'
import { useCategoryStore } from '@/stores/categories'
import { useThemeStore } from '@/stores/theme'
import { readBackdropConfig } from '@/utils/themeBackdrop'
import type {
  BarrierProgressResponse,
  CampaignBarrierResponse,
  CampaignDetailResponse,
  CampaignDifficultyProgressResponse,
  CampaignDifficultyResponse,
  CampaignLeaderboardPlayer,
  CampaignProgressResponse,
} from '@/types/api/campaigns'
import { campaignBadges } from '@/utils/campaignBadges'
import {
  campaignDifficultyColor,
  campaignDifficultyGradient,
  campaignDifficultyLabel,
} from '@/utils/campaignDifficulty'
import {
  barrierConditionLabel,
  barrierGoalValue,
  barrierReadout,
  formatUserValue,
  requirementGoalText,
  requirementLabel,
} from '@/utils/campaignLayout'
import { collectMissingPrerequisites } from '@/utils/campaignProgress'
import { buildMapRoute } from '@/utils/mapRoute'
import { isCurationSurface } from '@/utils/subdomain'
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const loadMarkdownText = () => import('@/components/common/MarkdownText.vue')

const MarkdownText = defineAsyncComponent(loadMarkdownText)

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const categoryStore = useCategoryStore()
const themeStore = useThemeStore()
const { itemsById: rewardItemsById, ensureLoaded: ensureRewardItems } = useItemCatalog()

const themeBackdropActive = computed(() => readBackdropConfig(themeStore.activeTokens) !== null)

const campaign = ref<CampaignDetailResponse | null>(null)

usePageMeta({
  title: computed(() =>
    campaign.value ? `${campaign.value.name} | AccSaber Campaigns` : 'Campaign | AccSaber',
  ),
  description: computed(() =>
    campaign.value ? `The ${campaign.value.name} campaign on AccSaber.` : undefined,
  ),
})

const myProgress = ref<CampaignProgressResponse | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const selectedId = ref<string | null>(null)
const hoverId = ref<string | null>(null)
const starting = ref(false)
const abandoning = ref(false)
const actionError = ref<string | null>(null)

const idOrSlug = computed(() => String(route.params.campaignId ?? ''))

const spectatePlayer = ref<CampaignLeaderboardPlayer | null>(null)
const spectateProgress = ref<CampaignProgressResponse | null>(null)
const spectateLoading = ref(false)
const spectateError = ref<string | null>(null)

const spectateUserId = computed(() => {
  const raw = route.query.viewing
  const value = Array.isArray(raw) ? raw[0] : raw
  return value ? String(value) : null
})

const isSpectating = computed(() => spectateUserId.value !== null)

const spectateName = computed(
  () => spectatePlayer.value?.userName ?? (isSpectating.value ? 'this player' : ''),
)

const activeProgress = computed(() =>
  isSpectating.value ? spectateProgress.value : myProgress.value,
)

let spectateSeq = 0

async function loadSpectatedProgress() {
  const userId = spectateUserId.value
  const campaignId = campaign.value?.id
  if (!userId || !campaignId) {
    spectateProgress.value = null
    spectateError.value = null
    spectateLoading.value = false
    return
  }
  const seq = ++spectateSeq
  spectateLoading.value = true
  spectateError.value = null
  spectateProgress.value = null
  try {
    const { getUser, getUserCampaignProgress } = await import('@/api/users')
    if (spectatePlayer.value?.userId !== userId) {
      spectatePlayer.value = null
      void getUser(userId).then((user) => {
        if (seq !== spectateSeq) return
        spectatePlayer.value = {
          userId: user.id,
          userName: user.name,
          country: user.country,
          avatarUrl: user.avatarUrl,
          cdnAvatarUrl: user.cdnAvatarUrl ?? undefined,
        }
      }, () => {})
    }
    const result = await getUserCampaignProgress(userId, campaignId)
    if (seq !== spectateSeq) return
    spectateProgress.value = result
  } catch (err) {
    if (seq !== spectateSeq) return
    spectateError.value = getApiErrorMessage(err, 'Failed to load this run')
  } finally {
    if (seq === spectateSeq) spectateLoading.value = false
  }
}

function spectate(player: CampaignLeaderboardPlayer) {
  if (player.userId === spectateUserId.value) return
  spectatePlayer.value = player
  void router.replace({ query: { ...route.query, viewing: player.userId } })
}

function stopSpectating() {
  spectateSeq++
  spectatePlayer.value = null
  spectateProgress.value = null
  spectateError.value = null
  spectateLoading.value = false
  const query = { ...route.query }
  delete query.viewing
  void router.replace({ query })
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const fetched = await getCampaignByIdOrSlug(idOrSlug.value)

    if (fetched.status === 'DRAFT') {
      const isOwner = auth.isLoggedIn && !!fetched.creatorId && fetched.creatorId === auth.userId
      if (isOwner || auth.hasRole('ADMIN')) {
        await router.replace({
          name: 'campaign-editor',
          params: { campaignId: fetched.slug || fetched.id },
        })
        return
      }
      campaign.value = null
      error.value = 'Campaign not found.'
      return
    }

    campaign.value = fetched
    if (auth.isLoggedIn) {
      try {
        myProgress.value = await getMyCampaignProgress(fetched.id)
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 404)) throw e
        myProgress.value = null
      }
    } else {
      myProgress.value = null
    }
    if (fetched.completionItems.length > 0 || fetched.difficulties.some((d) => d.items.length > 0)) {
      void ensureRewardItems()
    }
    if (
      fetched.description ||
      fetched.difficulties.some((d) => d.description) ||
      fetched.barriers.some((b) => b.description)
    ) {
      void loadMarkdownText()
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      campaign.value = null
    } else {
      error.value = getApiErrorMessage(err, 'Failed to load campaign')
    }
  } finally {
    loading.value = false
  }
}


onMounted(load)

watch(() => idOrSlug.value, () => {
  selectedId.value = null
  hoverId.value = null
  void load()
})

watch(() => auth.isLoggedIn, (next, prev) => {
  if (next !== prev) void load()
})

watch([spectateUserId, () => campaign.value?.id], () => {
  void loadSpectatedProgress()
})

const categoryTags = computed(
  () => campaign.value?.tags.filter((t) => t.kind === 'CATEGORY') ?? [],
)

const accent = computed(() => {
  const cats = categoryTags.value
  if (cats.length !== 1 || !cats[0].categoryId) return 'var(--accent-overall)'
  const code = categoryStore.getCategoryCode(cats[0].categoryId)
  if (!code) return 'var(--accent-overall)'
  return categoryStore.getCategoryInfo(code)?.accent ?? 'var(--accent-overall)'
})

const difficultyLabel = computed<string | null>(() =>
  campaignDifficultyLabel(campaign.value?.tags ?? []),
)

const difficultyColor = computed(() =>
  campaignDifficultyColor(campaign.value?.tags ?? [], accent.value),
)

const difficultyGradient = computed(() => campaignDifficultyGradient(campaign.value?.tags ?? []))

const difficultyStyle = computed(() =>
  difficultyGradient.value
    ? { backgroundImage: difficultyGradient.value }
    : { color: difficultyColor.value },
)

const themeTags = computed(
  () => campaign.value?.tags.filter((t) => t.kind === 'THEME' || t.kind === 'GENRE') ?? [],
)

const hasBadges = computed(() => !!campaign.value && campaignBadges(campaign.value).length > 0)

const modeSentence = computed(() => {
  const c = campaign.value
  if (!c) return ''
  const goal = c.completionMode === 'ALL' ? 'Clear every node' : 'Reach the end'
  const order = c.progressionAgnostic ? ' in any order' : ''
  const retro = c.legacy ? ' Existing PBs count toward progress.' : ''
  return `${goal}${order}.${retro}`
})

const completedCount = computed(() => activeProgress.value?.completedDifficulties ?? 0)

const totalCount = computed(
  () =>
    campaign.value?.difficulties?.length
    ?? campaign.value?.difficultyCount
    ?? 0,
)

const completionPct = computed(() => {
  if (!totalCount.value) return 0
  return Math.round((completedCount.value / totalCount.value) * 100)
})

const isInProgress = computed(() => activeProgress.value?.progressStatus === 'IN_PROGRESS')
const isCompleted = computed(() => activeProgress.value?.progressStatus === 'COMPLETED')
const isAbandoned = computed(() => activeProgress.value?.progressStatus === 'ABANDONED')

const myIsInProgress = computed(() => myProgress.value?.progressStatus === 'IN_PROGRESS')
const myIsCompleted = computed(() => myProgress.value?.progressStatus === 'COMPLETED')
const myIsAbandoned = computed(() => myProgress.value?.progressStatus === 'ABANDONED')

const spectateStatusLabel = computed(() => {
  if (isCompleted.value) return 'Completed'
  if (isAbandoned.value) return 'Abandoned'
  if (isInProgress.value) return 'In progress'
  return 'Not started'
})

const spectateMilestone = computed(() => {
  const milestone = activeProgress.value?.currentMilestone
  if (!milestone) return null
  if (milestone.label) return milestone.label
  return campaign.value?.difficulties.find((d) => d.id === milestone.nodeId)?.songName ?? null
})

const spectateStartedAt = computed(() => {
  const started = activeProgress.value?.startedAt
  if (!started) return null
  return new Date(started).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
})

const isOwner = computed(
  () =>
    auth.isLoggedIn
    && !!campaign.value?.creatorId
    && campaign.value.creatorId === auth.userId,
)

const canManage = computed(
  () => isOwner.value || (isCurationSurface && auth.hasRole('CAMPAIGN_CURATOR')),
)

function goToEditor() {
  if (!campaign.value) return
  void router.push({
    name: 'campaign-editor',
    params: { campaignId: campaign.value.slug || campaign.value.id },
  })
}

const effectiveDifficultyProgress = computed<CampaignDifficultyProgressResponse[] | undefined>(() => {
  const diffs = activeProgress.value?.difficulties
  if (!diffs) return undefined
  if (isAbandoned.value) return diffs.map((p) => ({ ...p, unlocked: false, completed: false }))
  return diffs
})

const effectiveBarrierProgress = computed<BarrierProgressResponse[] | undefined>(() => {
  const barrs = activeProgress.value?.barriers
  if (!barrs) return undefined
  if (isAbandoned.value) return barrs.map((p) => ({ ...p, unlocked: false, satisfied: false }))
  return barrs
})

const progressByDifficulty = computed(() => {
  const map = new Map<string, CampaignDifficultyProgressResponse>()
  for (const p of effectiveDifficultyProgress.value ?? []) {
    map.set(p.node.id, p)
  }
  return map
})

const displayedId = computed(() => selectedId.value ?? hoverId.value ?? focusNodeId.value)

const displayedDifficulty = computed<CampaignDifficultyResponse | null>(() => {
  const id = displayedId.value
  if (!id) return null
  return campaign.value?.difficulties.find((d) => d.id === id) ?? null
})

const displayedProgress = computed(() => {
  const id = displayedId.value
  if (!id) return null
  return progressByDifficulty.value.get(id) ?? null
})

const rewardsActive = computed(() => campaign.value?.status === 'CURATED')

const difficultiesById = computed(() => {
  const map = new Map<string, CampaignDifficultyResponse>()
  for (const d of campaign.value?.difficulties ?? []) map.set(d.id, d)
  return map
})

const displayedRewardPending = computed(() => {
  if (!rewardsActive.value || isSpectating.value) return false
  const d = displayedDifficulty.value
  const p = displayedProgress.value
  return !!d && !!p && !!d.checkpointLabel && d.items.length > 0 && p.completed && !p.rewardsEarned
})

const displayedMissingPrereqNames = computed<string[]>(() => {
  const d = displayedDifficulty.value
  if (!displayedRewardPending.value || !d) return []
  return collectMissingPrerequisites(
    d.id,
    difficultiesById.value,
    (id) => progressByDifficulty.value.get(id)?.completed ?? false,
  ).map((n) => n.songName)
})

const progressByBarrier = computed(() => {
  const map = new Map<string, BarrierProgressResponse>()
  for (const p of effectiveBarrierProgress.value ?? []) map.set(p.barrier.id, p)
  return map
})

const displayedBarrier = computed<CampaignBarrierResponse | null>(() => {
  const id = displayedId.value
  if (!id) return null
  return campaign.value?.barriers.find((b) => b.id === id) ?? null
})

const displayedBarrierProgress = computed(() => {
  const id = displayedId.value
  if (!id) return null
  return progressByBarrier.value.get(id) ?? null
})

const barrierAccent = computed(() => displayedBarrier.value?.borderColor || 'var(--warning)')

const displayedTargets = computed(() => {
  const d = displayedDifficulty.value
  if (!d) return []
  const progress = displayedProgress.value?.targets ?? []
  return d.targets.map((t, index) => {
    const goal = requirementGoalText(t.requirementType, t.requirementValue, t.requirementValueMax)
    return {
      key: t.id ?? String(index),
      label: requirementLabel(t.requirementType),
      goal,
      goalWide: goal.length > 9,
      userValue: formatUserValue(t.requirementType, progress[index]?.userValue ?? null),
      met: progress[index]?.met ?? false,
    }
  })
})

const isMultiObjective = computed(() => displayedTargets.value.length > 1)

const objectiveModeLabel = computed(() => {
  if (!isMultiObjective.value) return 'Objective'
  return displayedDifficulty.value?.targetMode === 'OR'
    ? 'Clear any one of these'
    : 'Clear all of these'
})

const displayedBarrierGoal = computed(() => {
  const b = displayedBarrier.value
  if (!b) return null
  return barrierReadout(b.conditionType, b.conditionValue, b.conditionValueMax)
})

const barrierSubtitle = computed(() => {
  const b = displayedBarrier.value
  if (!b) return ''
  const n = b.affectedCampaignDifficultyIds.length
  const maps = n === 1 ? 'map' : 'maps'
  const lead =
    b.conditionType === 'COMPLETION_COUNT' ? 'Completions' : barrierConditionLabel(b.conditionType)
  return `${lead} across ${n} ${maps}`
})

function shortName(name: string): string {
  return name.length > 12 ? `${name.slice(0, 11)}…` : name
}

const viewerLabel = computed(() => (isSpectating.value ? shortName(spectateName.value) : 'You'))

const viewerPossessive = computed(() =>
  isSpectating.value ? `${shortName(spectateName.value)}'s` : 'Your',
)

const barrierProgressLabel = computed(() =>
  displayedBarrier.value?.conditionType === 'COMPLETION_COUNT'
    ? 'Completed'
    : `${viewerPossessive.value} best`,
)

const prereqsFor = computed(() => {
  if (!displayedDifficulty.value || !campaign.value) return []
  const byId = new Map(campaign.value.difficulties.map((d) => [d.id, d]))
  return (displayedDifficulty.value.prerequisites ?? [])
    .map((p) => byId.get(p.comesFromCampaignDifficultyId))
    .filter((d): d is CampaignDifficultyResponse => !!d)
})

const playlistUrl = computed(() => (campaign.value ? getPlaylistExportUrl(campaign.value.id) : ''))

const breadcrumbs = computed<Crumb[]>(() => [
  { label: 'Campaigns', to: '/campaigns' },
  { label: campaign.value?.name || 'Campaign' },
])

const briefingOpen = ref(false)

const nodeAccents = computed(() => {
  const map = new Map<string, string>()
  for (const d of campaign.value?.difficulties ?? []) {
    const custom = d.checkpointColor || d.borderColor
    if (custom) {
      map.set(d.id, custom)
      continue
    }
    if (!d.categoryId) continue
    const code = categoryStore.getCategoryCode(d.categoryId)
    if (!code) continue
    const a = categoryStore.getCategoryInfo(code)?.accent
    if (a) map.set(d.id, a)
  }
  return map
})

const displayedCover = computed(() => pickCoverUrl(displayedDifficulty.value))

const displayedAccent = computed(() => {
  const d = displayedDifficulty.value
  if (!d) return accent.value
  return nodeAccents.value.get(d.id) ?? accent.value
})

const displayedMapRoute = computed(() => {
  const d = displayedDifficulty.value
  if (!d) return null
  return buildMapRoute({
    beatsaverCode: d.beatsaverCode,
    mapId: d.mapId,
    difficulty: d.difficulty,
    difficultyId: d.mapDifficultyId,
    characteristic: d.characteristic,
  })
})


const focusNodeId = computed<string | null>(() => {
  const c = campaign.value
  if (!c || c.difficulties.length === 0) return null

  const cleared = activeProgress.value?.difficulties.filter((p) => p.completed) ?? []

  const rootId = () =>
    c.difficulties.find((d) => d.prerequisites.length === 0)?.id
    ?? c.difficulties[0].id

  if (cleared.length === 0) return rootId()

  const byId = new Map(c.difficulties.map((d) => [d.id, d]))
  const depthMemo = new Map<string, number>()
  const depthOf = (id: string, seen = new Set<string>()): number => {
    if (depthMemo.has(id)) return depthMemo.get(id)!
    if (seen.has(id)) return 0
    const node = byId.get(id)
    if (!node || node.prerequisites.length === 0) {
      depthMemo.set(id, 0)
      return 0
    }
    seen.add(id)
    let max = 0
    for (const p of node.prerequisites) {
      max = Math.max(max, 1 + depthOf(p.comesFromCampaignDifficultyId, seen))
    }
    seen.delete(id)
    depthMemo.set(id, max)
    return max
  }

  if (isInProgress.value && !c.progressionAgnostic) {
    const frontier =
      activeProgress.value?.difficulties.filter((p) => p.unlocked && !p.completed) ?? []
    if (frontier.length > 0) {
      let next = { id: frontier[0].node.id, depth: Infinity }
      for (const f of frontier) {
        const d = depthOf(f.node.id)
        if (d < next.depth) next = { id: f.node.id, depth: d }
      }
      return next.id
    }
  }

  if (c.completionMode === 'ALL' || c.progressionAgnostic) {
    return cleared[cleared.length - 1].node.id
  }

  let best = { id: cleared[0].node.id, depth: -1 }
  for (const c2 of cleared) {
    const d = depthOf(c2.node.id)
    if (d > best.depth) best = { id: c2.node.id, depth: d }
  }
  return best.id
})


let progressRefreshTimer: ReturnType<typeof setTimeout> | null = null

function scheduleProgressRefresh(campaignId: string) {
  if (progressRefreshTimer) clearTimeout(progressRefreshTimer)
  progressRefreshTimer = setTimeout(async () => {
    progressRefreshTimer = null
    if (campaign.value?.id !== campaignId) return
    try {
      myProgress.value = await getMyCampaignProgress(campaignId)
    } catch {
    }
  }, 2500)
}

async function onStart() {
  if (!campaign.value || starting.value) return
  starting.value = true
  actionError.value = null
  try {
    await startCampaign(campaign.value.id)
    myProgress.value = await getMyCampaignProgress(campaign.value.id)
    if (campaign.value.legacy) scheduleProgressRefresh(campaign.value.id)
  } catch (err) {
    actionError.value = getApiErrorMessage(err, 'Failed to start campaign')
  } finally {
    starting.value = false
  }
}

async function onAbandon() {
  if (!campaign.value || abandoning.value) return
  if (!window.confirm('Abandon this campaign? Your progress will reset.')) return
  abandoning.value = true
  actionError.value = null
  try {
    await abandonCampaign(campaign.value.id)
    myProgress.value = await getMyCampaignProgress(campaign.value.id)
  } catch (err) {
    actionError.value = getApiErrorMessage(err, 'Failed to abandon campaign')
  } finally {
    abandoning.value = false
  }
}

const cursorPos = ref({ x: 0, y: 0 })
const pinnedPos = ref<{ x: number; y: number } | null>(null)

const TOOLTIP_WIDTH = 340
const TOOLTIP_FALLBACK_HEIGHT = 520
const TOOLTIP_GAP = 18
const VIEWPORT_MARGIN = 8

const tooltipEl = ref<HTMLElement | null>(null)
const tooltipHeight = ref(TOOLTIP_FALLBACK_HEIGHT)
const viewport = ref({ w: 1280, h: 720 })
let tooltipResize: ResizeObserver | null = null

function onPageMouseMove(e: MouseEvent) {
  cursorPos.value = { x: e.clientX, y: e.clientY }
}

function readViewport() {
  viewport.value = { w: window.innerWidth, h: window.innerHeight }
}

watch(tooltipEl, (el) => {
  tooltipResize?.disconnect()
  tooltipResize = null
  if (!el) return
  tooltipHeight.value = el.offsetHeight
  tooltipResize = new ResizeObserver(() => {
    if (tooltipEl.value) tooltipHeight.value = tooltipEl.value.offsetHeight
  })
  tooltipResize.observe(el)
})

onMounted(() => {
  readViewport()
  document.addEventListener('mousemove', onPageMouseMove)
  window.addEventListener('resize', readViewport)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onPageMouseMove)
  window.removeEventListener('resize', readViewport)
  tooltipResize?.disconnect()
  if (progressRefreshTimer) clearTimeout(progressRefreshTimer)
})

const tooltipPos = computed(() => {
  const base = pinnedPos.value ?? cursorPos.value
  const { w: vw, h: vh } = viewport.value
  const height = Math.min(tooltipHeight.value, vh - VIEWPORT_MARGIN * 2)
  const fitsRight = base.x + TOOLTIP_GAP + TOOLTIP_WIDTH <= vw - VIEWPORT_MARGIN
  const x = fitsRight
    ? base.x + TOOLTIP_GAP
    : Math.max(VIEWPORT_MARGIN, base.x - TOOLTIP_GAP - TOOLTIP_WIDTH)
  let y = base.y + TOOLTIP_GAP
  if (y + height > vh - VIEWPORT_MARGIN) y = base.y - TOOLTIP_GAP - height
  if (y < VIEWPORT_MARGIN) y = Math.max(VIEWPORT_MARGIN, vh - height - VIEWPORT_MARGIN)
  return { x, y }
})

const tooltipPinned = computed(() => !!selectedId.value)

const tooltipVisible = computed(
  () =>
    (!!displayedDifficulty.value || !!displayedBarrier.value) &&
    (!!hoverId.value || !!selectedId.value),
)

function handleSelect(id: string) {
  selectedId.value = id
  pinnedPos.value = { ...cursorPos.value }
}

const lbNodeId = ref<string | null>(null)

watch(selectedId, (id) => {
  if (id && campaign.value?.difficulties.some((d) => d.id === id)) {
    lbNodeId.value = id
  } else if (!id) {
    lbNodeId.value = null
  }
})

function handleHover(id: string | null, point?: { x: number; y: number }) {
  hoverId.value = id
  if (point) cursorPos.value = point
}

function handleDeselect() {
  selectedId.value = null
  pinnedPos.value = null
}

function unpinTooltip() {
  selectedId.value = null
  pinnedPos.value = null
}
</script>

<template>
  <div
    class="campaign-detail"
    :class="{ 'campaign-detail--backdrop': themeBackdropActive }"
    :style="{ '--page-accent': accent }"
  >
    <template v-if="loading">
      <div class="campaign-detail__loading">
        <SkeletonLoader variant="card" />
        <SkeletonLoader variant="card" />
      </div>
    </template>

    <template v-else-if="error">
      <EmptyState icon="!" :message="error" />
    </template>

    <template v-else-if="!campaign">
      <EmptyState icon="?" message="Campaign not found." />
    </template>

    <template v-else>
      <main class="campaign-detail__canvas" aria-label="Campaign roadmap">
        <CampaignRoadmap :difficulties="campaign.difficulties" :barriers="campaign.barriers"
          :texts="campaign.texts" :progress="effectiveDifficultyProgress" :barrier-progress="effectiveBarrierProgress"
          :accent-color="accent" :node-accents="nodeAccents" :background-url="campaign.backgroundUrl"
          :background-color="campaign.backgroundColor"
          :background-placement="campaign.background"
          :show-starfield="!campaign.backgroundUrl" :focus-id="focusNodeId" :default-scale="1.35"
          :selected-id="selectedId" :highlight-barrier-id="selectedId"
          :mark-next="isInProgress && !campaign.progressionAgnostic"
          @select="handleSelect" @hover="handleHover"
          @deselect="handleDeselect" />

        <div class="campaign-detail__topbar">
          <Breadcrumbs class="campaign-detail__breadcrumbs" :crumbs="breadcrumbs" />

          <Transition name="campaign-detail__spectate-fade">
            <div v-if="isSpectating" class="campaign-detail__spectate">
              <button
                type="button"
                class="campaign-detail__spectate-back"
                @click="stopSpectating"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                {{ auth.isLoggedIn ? 'Back to your run' : 'Stop viewing' }}
              </button>

              <span class="campaign-detail__spectate-rule" aria-hidden="true" />

              <p class="campaign-detail__spectate-who" role="status">
                <img
                  v-if="spectatePlayer"
                  class="campaign-detail__spectate-avatar"
                  :src="pickAvatarUrl(spectatePlayer)"
                  alt=""
                  loading="lazy"
                  decoding="async"
                  @error="onAvatarError(pickAvatarFallback(spectatePlayer))($event)"
                />
                <span class="campaign-detail__spectate-name">{{ spectateName }}</span>
                <CountryFlag v-if="spectatePlayer?.country" :country="spectatePlayer.country" />
              </p>

              <span v-if="spectateLoading" class="campaign-detail__spectate-note">Loading run</span>
              <span v-else-if="spectateError" class="campaign-detail__spectate-note campaign-detail__spectate-note--error">
                {{ spectateError }}
              </span>
              <template v-else>
                <span class="campaign-detail__spectate-stat">
                  {{ completedCount }}<span class="campaign-detail__spectate-slash">/</span>{{ totalCount }}
                </span>
                <span class="campaign-detail__spectate-stat campaign-detail__spectate-stat--muted">
                  {{ completionPct }}%
                </span>
                <span
                  class="campaign-detail__spectate-pill"
                  :class="{ 'campaign-detail__spectate-pill--done': isCompleted }"
                >
                  {{ spectateStatusLabel }}
                </span>
              </template>

              <router-link
                v-if="spectateUserId"
                class="campaign-detail__spectate-profile"
                :to="{ name: 'player-profile', params: { userId: spectateUserId } }"
              >
                Profile
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <line x1="7" y1="17" x2="17" y2="7" />
                  <polyline points="8 7 17 7 17 16" />
                </svg>
              </router-link>
            </div>
          </Transition>
        </div>
      </main>

      <CampaignLeaderboardTray
        v-if="campaign.status !== 'DRAFT'"
        :campaign="campaign"
        :node-id="lbNodeId"
        :spectating-user-id="spectateUserId"
        @update:node-id="lbNodeId = $event"
        @spectate="spectate"
      />

      <div class="campaign-detail__floats">
        <aside class="campaign-detail__rail campaign-detail__rail--left" aria-label="Campaign overview">
          <header class="campaign-detail__title-block">
            <h1 class="campaign-detail__title">{{ campaign.name }}</h1>
            <p class="campaign-detail__byline">
              by
              <span class="campaign-detail__creator-name">
                {{ campaign.creatorAlias || campaign.creatorName || 'AccSaber' }}
              </span>
            </p>
            <p v-if="hasBadges" class="campaign-detail__badge-row">
              <CampaignStatusBadge :campaign="campaign" size="md" />
            </p>
            <CampaignCurationCredits :campaign="campaign" />
            <p v-if="categoryTags.length" class="campaign-detail__taxonomy">
              <CampaignCategoryTags :tags="campaign.tags" />
            </p>
            <p v-if="difficultyLabel || themeTags.length" class="campaign-detail__traits">
              <span v-if="difficultyLabel" class="campaign-detail__trait">
                <span class="campaign-detail__difficulty"
                  :class="{ 'campaign-detail__difficulty--fade': difficultyGradient }"
                  :style="difficultyStyle">{{ difficultyLabel }}</span>
              </span>
              <span v-for="tag in themeTags" :key="tag.id" class="campaign-detail__trait">{{ tag.name }}</span>
            </p>
            <p class="campaign-detail__mode">{{ modeSentence }}</p>
          </header>

          <p v-if="campaign.summary" class="campaign-detail__summary">{{ campaign.summary }}</p>

          <CampaignVoteControl class="campaign-detail__vote" :campaign="campaign" size="md" />

          <div class="campaign-detail__actions">
            <template v-if="isSpectating" />
            <template v-else-if="!auth.isLoggedIn">
              <p class="campaign-detail__hint">Sign in to track progress and start this campaign.</p>
            </template>
            <template v-else-if="myIsInProgress">
              <BaseButton variant="default" size="md" :loading="abandoning" @click="onAbandon">
                Abandon campaign
              </BaseButton>
            </template>
            <template v-else-if="myIsCompleted">
              <span class="campaign-detail__status">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Completed, +{{ campaign.completionXp.toLocaleString() }} XP earned
              </span>
            </template>
            <template v-else>
              <BaseButton variant="primary" size="md" :loading="starting" @click="onStart">
                Begin campaign
              </BaseButton>
            </template>

            <BaseButton
              v-if="campaign.playlistExportEnabled"
              :href="playlistUrl"
              size="sm"
              aria-label="Download Beat Saber playlist"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download playlist
            </BaseButton>

            <p v-if="actionError" class="campaign-detail__error" role="alert">{{ actionError }}</p>
            <p v-if="!isSpectating && myIsAbandoned" class="campaign-detail__hint">
              Previously abandoned. Beginning again resets progress.
            </p>

            <button v-if="canManage" type="button" class="campaign-detail__manage" @click="goToEditor">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              Edit campaign
            </button>
          </div>

          <section
            class="campaign-detail__progress"
            :class="{ 'campaign-detail__progress--spectating': isSpectating }"
            :aria-label="isSpectating ? `${spectateName}'s progression` : 'Your progression'"
          >
            <h2 v-if="isSpectating" class="campaign-detail__progress-subject">
              {{ spectateName }}'s run
            </h2>

            <template v-if="isSpectating && spectateLoading">
              <SkeletonLoader variant="stat-block" />
            </template>
            <p v-else-if="isSpectating && spectateError" class="campaign-detail__error" role="alert">
              {{ spectateError }}
            </p>
            <template v-else>
              <div class="campaign-detail__progress-row">
                <span class="campaign-detail__progress-label">Cleared</span>
                <span class="campaign-detail__progress-count">
                  <span class="campaign-detail__progress-num">{{ completedCount }}</span>
                  <span class="campaign-detail__progress-sep">of</span>
                  <span class="campaign-detail__progress-total">{{ totalCount }}</span>
                </span>
              </div>
              <div class="campaign-detail__progress-track"
                :aria-valuenow="completionPct" aria-valuemin="0" aria-valuemax="100" role="progressbar">
                <div class="campaign-detail__progress-fill"
                  :style="{ transform: `scaleX(${completionPct / 100})`, background: accent }" />
              </div>
              <div class="campaign-detail__progress-foot">
                <span>{{ completionPct }}% complete</span>
                <span v-if="!isSpectating" class="campaign-detail__xp-note">
                  <CampaignRewardNotice
                    v-if="campaign.completionXp > 0"
                    :curated="campaign.status === 'CURATED'"
                  />
                  +{{ campaign.completionXp.toLocaleString() }} XP on finish
                </span>
                <span v-else>{{ spectateStatusLabel }}</span>
              </div>
              <p v-if="isSpectating && (spectateStartedAt || spectateMilestone)"
                class="campaign-detail__progress-meta">
                <span v-if="spectateStartedAt">Started {{ spectateStartedAt }}</span>
                <span v-if="spectateMilestone">Furthest: {{ spectateMilestone }}</span>
              </p>
            </template>
          </section>

          <section v-if="campaign.description" class="campaign-detail__brief">
            <button type="button" class="campaign-detail__brief-toggle"
              :aria-expanded="briefingOpen" @click="briefingOpen = !briefingOpen">
              <span class="campaign-detail__section-label">Briefing</span>
              <svg class="campaign-detail__brief-chevron"
                :class="{ 'campaign-detail__brief-chevron--open': briefingOpen }"
                width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5"
                  stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            <MarkdownText
              v-if="briefingOpen"
              :content="campaign.description"
            />
          </section>

          <section v-if="campaign.curatorNotes" class="campaign-detail__brief">
            <h2 class="campaign-detail__section-label">From the curator</h2>
            <p class="campaign-detail__notes">{{ campaign.curatorNotes }}</p>
          </section>

          <section v-if="campaign.completionItems.length > 0" class="campaign-detail__rewards-block">
            <h2 class="campaign-detail__section-label">
              <span class="campaign-detail__label-notice">
                Completion rewards
                <CampaignRewardNotice :curated="campaign.status === 'CURATED'" />
              </span>
            </h2>
            <ul class="campaign-detail__rewards-list">
              <li v-for="item in campaign.completionItems" :key="item.itemId" class="campaign-detail__reward">
                <CampaignRewardItem :name="item.itemName" :quantity="item.quantity"
                  :item="rewardItemsById.get(item.itemId) ?? null" />
              </li>
            </ul>
          </section>
        </aside>

        <Transition name="campaign-detail__tooltip-fade">
          <aside v-if="tooltipVisible && displayedDifficulty"
            ref="tooltipEl"
            class="campaign-detail__tooltip"
            :class="{
              'campaign-detail__tooltip--pinned': tooltipPinned,
              'campaign-detail__tooltip--locked': displayedProgress && !displayedProgress.unlocked,
              'campaign-detail__tooltip--cleared': displayedProgress?.completed,
            }"
            :style="{
              '--page-accent': displayedAccent,
              left: tooltipPos.x + 'px',
              top: tooltipPos.y + 'px',
            }">
            <header class="campaign-detail__node-head">
              <div class="campaign-detail__tooltip-state">
                <span v-if="displayedProgress?.completed"
                  class="campaign-detail__node-state campaign-detail__node-state--done">
                  Cleared
                </span>
                <span v-else-if="displayedProgress && !displayedProgress.unlocked"
                  class="campaign-detail__node-state campaign-detail__node-state--locked">
                  Locked
                </span>
                <span v-else class="campaign-detail__node-state" :style="{ color: displayedAccent }">
                  Available
                </span>
                <button v-if="tooltipPinned" type="button" class="campaign-detail__tooltip-close"
                  aria-label="Unpin" @click="unpinTooltip">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="6" y1="6" x2="18" y2="18" />
                    <line x1="18" y1="6" x2="6" y2="18" />
                  </svg>
                </button>
              </div>
            </header>

            <div class="campaign-detail__node-song">
              <div class="campaign-detail__node-cover">
                <img v-if="displayedCover" :src="displayedCover"
                  :alt="displayedDifficulty.songName" loading="lazy" />
              </div>
              <div class="campaign-detail__node-meta">
                <h2 class="campaign-detail__node-title">{{ displayedDifficulty.songName }}</h2>
                <p class="campaign-detail__node-artist">
                  {{ displayedDifficulty.songAuthor }}
                  <span class="campaign-detail__node-sep">·</span>
                  {{ displayedDifficulty.mapAuthor }}
                </p>
                <div class="campaign-detail__node-badges">
                  <DifficultyBadge :difficulty="displayedDifficulty.difficulty" />
                  <span v-if="displayedDifficulty.characteristic && displayedDifficulty.characteristic.toLowerCase() !== 'standard'"
                    class="campaign-detail__node-char">{{ displayedDifficulty.characteristic }}</span>
                  <span v-if="displayedDifficulty.complexity != null" class="campaign-detail__node-badge-sep" aria-hidden="true">·</span>
                  <ComplexityBadge v-if="displayedDifficulty.complexity != null"
                    :complexity="displayedDifficulty.complexity" />
                </div>
              </div>
            </div>

            <div v-if="displayedTargets.length > 0" class="campaign-detail__objectives">
              <h3 class="campaign-detail__section-label">
                {{ objectiveModeLabel }}
              </h3>
              <table class="campaign-detail__objective-table">
                <tbody>
                  <tr
                    v-for="t in displayedTargets"
                    :key="t.key"
                    :class="{ 'campaign-detail__objective-row--met': t.met }"
                  >
                    <th scope="row">
                      <span
                        v-if="displayedProgress"
                        class="campaign-detail__objective-tick"
                        :class="{ 'campaign-detail__objective-tick--met': t.met }"
                        aria-hidden="true"
                      >
                        <svg
                          v-if="t.met"
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="3.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                      {{ t.label }}
                    </th>
                    <td v-if="displayedProgress" class="campaign-detail__objective-you">
                      <span class="campaign-detail__objective-you-who">{{ viewerLabel }}</span>
                      {{ t.userValue }}
                    </td>
                    <td
                      class="campaign-detail__objective-goal"
                      :class="{ 'campaign-detail__objective-goal--wide': t.goalWide }"
                      :style="{ color: displayedAccent }"
                    >
                      {{ t.goal }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-if="displayedDifficulty.modifiers.length > 0" class="campaign-detail__mods">
              <h3 class="campaign-detail__section-label">Modifiers</h3>
              <CampaignModifierBadges :modifiers="displayedDifficulty.modifiers" />
            </div>

            <MapChartStats :source="displayedDifficulty" />

            <MarkdownText
              v-if="displayedDifficulty.description"
              :content="displayedDifficulty.description"
            />

            <div v-if="prereqsFor.length > 0 && !campaign.progressionAgnostic" class="campaign-detail__prereqs">
              <h3 class="campaign-detail__section-label">
                {{ prereqsFor.length >= 2
                  ? (displayedDifficulty.prerequisiteMode === 'AND' ? 'Requires all of' : 'Requires any of')
                  : 'Requires' }}
              </h3>
              <ul class="campaign-detail__prereq-list">
                <li v-for="pr in prereqsFor" :key="pr.id" class="campaign-detail__prereq"
                  :class="{ 'campaign-detail__prereq--done': progressByDifficulty.get(pr.id)?.completed }"
                  @click="handleSelect(pr.id)">
                  <span class="campaign-detail__prereq-tick" aria-hidden="true">
                    <svg v-if="progressByDifficulty.get(pr.id)?.completed" width="10" height="10"
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"
                      stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  {{ pr.songName }}
                </li>
              </ul>
            </div>

            <div
              v-if="displayedDifficulty.items.length > 0 || displayedDifficulty.xp > 0"
              class="campaign-detail__node-rewards"
            >
              <h3 class="campaign-detail__section-label">
                <span class="campaign-detail__label-notice">
                  Awards
                  <CampaignRewardNotice :curated="campaign.status === 'CURATED'" />
                </span>
                <span v-if="displayedDifficulty.xp > 0" class="campaign-detail__node-xp">
                  +{{ displayedDifficulty.xp.toLocaleString() }} XP
                </span>
              </h3>
              <ul v-if="displayedDifficulty.items.length > 0" class="campaign-detail__rewards-list">
                <li v-for="item in displayedDifficulty.items" :key="item.itemId"
                  class="campaign-detail__reward"
                  :class="{ 'campaign-detail__reward--withheld': displayedRewardPending }">
                  <CampaignRewardItem :name="item.itemName" :quantity="item.quantity"
                    :item="rewardItemsById.get(item.itemId) ?? null" />
                  <span v-if="displayedRewardPending" class="campaign-detail__reward-hold" aria-hidden="true">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M6 2h12M6 22h12M7 2v4l5 6-5 6v4M17 2v4l-5 6 5 6v4" />
                    </svg>
                  </span>
                </li>
              </ul>
              <div v-if="displayedRewardPending" class="campaign-detail__reward-pending" role="note">
                <p>Milestone reached - rewards unlock automatically when you complete the remaining maps.</p>
                <p v-if="displayedMissingPrereqNames.length > 0">
                  Still needed: {{ displayedMissingPrereqNames.join(', ') }}
                </p>
              </div>
            </div>

            <router-link v-if="displayedMapRoute" :to="displayedMapRoute" class="campaign-detail__node-link">
              Open map detail
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="9 6 15 12 9 18" />
              </svg>
            </router-link>
          </aside>
        </Transition>

        <Transition name="campaign-detail__tooltip-fade">
          <aside
            v-if="tooltipVisible && displayedBarrier && !displayedDifficulty"
            ref="tooltipEl"
            class="campaign-detail__tooltip campaign-detail__tooltip--barrier"
            :class="{
              'campaign-detail__tooltip--pinned': tooltipPinned,
              'campaign-detail__tooltip--locked':
                displayedBarrierProgress && !displayedBarrierProgress.unlocked,
              'campaign-detail__tooltip--cleared': displayedBarrierProgress?.satisfied,
            }"
            :style="{
              '--page-accent': barrierAccent,
              left: tooltipPos.x + 'px',
              top: tooltipPos.y + 'px',
            }"
          >
            <header class="campaign-detail__node-head">
              <div class="campaign-detail__tooltip-state">
                <span
                  v-if="displayedBarrierProgress?.satisfied"
                  class="campaign-detail__node-state campaign-detail__node-state--done"
                >
                  Passed
                </span>
                <span
                  v-else-if="displayedBarrierProgress && !displayedBarrierProgress.unlocked"
                  class="campaign-detail__node-state campaign-detail__node-state--locked"
                >
                  Locked
                </span>
                <span v-else class="campaign-detail__node-state" :style="{ color: barrierAccent }">
                  Gate
                </span>
                <button
                  v-if="tooltipPinned"
                  type="button"
                  class="campaign-detail__tooltip-close"
                  aria-label="Unpin"
                  @click="unpinTooltip"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="6" y1="6" x2="18" y2="18" />
                    <line x1="18" y1="6" x2="6" y2="18" />
                  </svg>
                </button>
              </div>
            </header>

            <div class="campaign-detail__barrier-head">
              <span
                class="campaign-detail__barrier-icon"
                :style="{ color: barrierAccent }"
                aria-hidden="true"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <line x1="12" y1="3" x2="12" y2="21" />
                  <line x1="7" y1="6" x2="17" y2="6" />
                  <line x1="7" y1="18" x2="17" y2="18" />
                </svg>
              </span>
              <div class="campaign-detail__node-meta">
                <h2 class="campaign-detail__node-title">
                  {{ displayedBarrier.checkpointLabel || 'Checkpoint gate' }}
                </h2>
                <p class="campaign-detail__node-artist">{{ barrierSubtitle }}</p>
              </div>
            </div>

            <div
              v-if="displayedBarrierGoal && displayedBarrier.conditionType !== 'FC' && displayedBarrier.conditionType !== 'PASS'"
              class="campaign-detail__targets"
            >
              <div class="campaign-detail__target">
                <span class="campaign-detail__target-label">{{ displayedBarrierGoal.label }}</span>
                <span class="campaign-detail__target-value" :style="{ color: barrierAccent }">
                  {{ displayedBarrierGoal.text }}
                </span>
              </div>
              <div v-if="displayedBarrierProgress" class="campaign-detail__target">
                <span class="campaign-detail__target-label">{{ barrierProgressLabel }}</span>
                <span class="campaign-detail__target-value">
                  {{ barrierGoalValue(displayedBarrier.conditionType, displayedBarrierProgress.currentValue) }}
                </span>
              </div>
            </div>

            <MarkdownText
              v-if="displayedBarrier.description"
              :content="displayedBarrier.description"
            />

            <div
              v-if="displayedBarrier.items.length > 0 || displayedBarrier.xp > 0"
              class="campaign-detail__node-rewards"
            >
              <h3 class="campaign-detail__section-label">
                <span class="campaign-detail__label-notice">
                  Awards
                  <CampaignRewardNotice :curated="campaign.status === 'CURATED'" />
                </span>
                <span v-if="displayedBarrier.xp > 0" class="campaign-detail__node-xp">
                  +{{ displayedBarrier.xp.toLocaleString() }} XP
                </span>
              </h3>
              <ul v-if="displayedBarrier.items.length > 0" class="campaign-detail__rewards-list">
                <li
                  v-for="item in displayedBarrier.items"
                  :key="item.itemId"
                  class="campaign-detail__reward"
                >
                  <CampaignRewardItem
                    :name="item.itemName"
                    :quantity="item.quantity"
                    :item="rewardItemsById.get(item.itemId) ?? null"
                  />
                </li>
              </ul>
            </div>
          </aside>
        </Transition>
      </div>
    </template>
  </div>
</template>

<style scoped>
.campaign-detail {
  position: fixed;
  inset: var(--navbar-height) 0 0 0;
  width: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  background: var(--bg-base);
}

.campaign-detail--backdrop {
  background: transparent;
}

.campaign-detail__loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  max-width: 720px;
  margin: var(--space-lg) auto;
  padding: 0 var(--space-md);
}

.campaign-detail__canvas {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.campaign-detail__topbar {
  position: absolute;
  top: var(--space-md);
  left: var(--space-md);
  right: calc(var(--space-md) * 2 + 340px);
  z-index: 4;
  display: flex;
  align-items: center;
  gap: var(--space-md);
  min-width: 0;
  pointer-events: none;
}

.campaign-detail__breadcrumbs {
  flex-shrink: 0;
  pointer-events: auto;
}

.campaign-detail__spectate {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-width: 0;
  padding: 5px var(--space-sm) 5px 6px;
  background: var(--bg-surface);
  border: 1px solid color-mix(in srgb, var(--page-accent) 45%, var(--bg-overlay));
  border-radius: 4px;
  pointer-events: auto;
}

.campaign-detail__spectate-back {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  padding: 3px 7px 3px 5px;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  cursor: pointer;
  transition:
    color 120ms ease,
    border-color 120ms ease;
}

.campaign-detail__spectate-back:hover,
.campaign-detail__spectate-back:focus-visible {
  outline: none;
  color: var(--text-primary);
  border-color: var(--bg-overlay);
}

.campaign-detail__spectate-rule {
  width: 1px;
  height: 18px;
  flex-shrink: 0;
  background: var(--bg-overlay);
}

.campaign-detail__spectate-who {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  margin: 0;
}

.campaign-detail__spectate-avatar {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  border-radius: var(--radius-avatar);
  object-fit: cover;
  background: var(--bg-elevated);
}

.campaign-detail__spectate-name {
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.campaign-detail__spectate-stat {
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}

.campaign-detail__spectate-stat--muted {
  color: var(--text-secondary);
}

.campaign-detail__spectate-slash {
  padding: 0 1px;
  color: var(--text-tertiary);
}

.campaign-detail__spectate-note {
  flex-shrink: 0;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  color: var(--text-tertiary);
}

.campaign-detail__spectate-note--error {
  color: var(--error);
}

.campaign-detail__spectate-pill {
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

.campaign-detail__spectate-pill--done {
  color: var(--success);
  border-color: color-mix(in srgb, var(--success) 45%, transparent);
}

.campaign-detail__spectate-profile {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  font-family: var(--font-sans);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  text-decoration: none;
  transition: color 120ms ease;
}

.campaign-detail__spectate-profile:hover,
.campaign-detail__spectate-profile:focus-visible {
  color: var(--page-accent);
}

.campaign-detail__spectate-fade-enter-active,
.campaign-detail__spectate-fade-leave-active {
  transition:
    opacity 140ms ease,
    transform 140ms ease;
}

.campaign-detail__spectate-fade-enter-from,
.campaign-detail__spectate-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.campaign-detail__floats {
  position: absolute;
  inset: calc(var(--space-md) + 40px) var(--space-md) var(--space-md);
  display: grid;
  grid-template-columns: minmax(280px, 340px) 1fr;
  gap: var(--space-md);
  pointer-events: none;
  z-index: 5;
}

.campaign-detail__tooltip {
  position: fixed;
  width: 340px;
  max-height: 80vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: 4px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  z-index: 50;
  pointer-events: auto;
  scrollbar-width: thin;
  scrollbar-gutter: stable;
}

.campaign-detail__tooltip:not(.campaign-detail__tooltip--pinned) {
  pointer-events: none;
}

.campaign-detail__barrier-head {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.campaign-detail__barrier-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border: 1px solid color-mix(in srgb, currentColor 45%, transparent);
  background: color-mix(in srgb, currentColor 12%, transparent);
  border-radius: 4px;
}

.campaign-detail__tooltip--pinned {
  border-color: var(--page-accent);
}

.campaign-detail__tooltip--cleared {
  border-color: color-mix(in srgb, var(--success) 35%, var(--bg-overlay));
}

.campaign-detail__tooltip--locked {
  opacity: 0.85;
}

.campaign-detail__tooltip-state {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
}

.campaign-detail__tooltip-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  background: transparent;
  border: 1px solid var(--bg-overlay);
  border-radius: 2px;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: color 120ms ease, border-color 120ms ease;
}

.campaign-detail__tooltip-close:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.campaign-detail__tooltip-fade-enter-active,
.campaign-detail__tooltip-fade-leave-active {
  transition: opacity 140ms ease, transform 140ms ease;
}

.campaign-detail__tooltip-fade-enter-from,
.campaign-detail__tooltip-fade-leave-to {
  opacity: 0;
  transform: translateY(-2px);
}

@media (prefers-reduced-motion: reduce) {
  .campaign-detail__tooltip-fade-enter-active,
  .campaign-detail__tooltip-fade-leave-active {
    transition: none;
  }
}

.campaign-detail__rail {
  grid-row: 1;
  align-self: start;
  max-height: calc(100vh - var(--navbar-height) - var(--space-md) * 2);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  padding: var(--space-md);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: 4px;
  pointer-events: auto;
  scrollbar-width: thin;
  scrollbar-gutter: stable;
}

.campaign-detail__rail--left {
  grid-column: 1;
}


.campaign-detail__rail::-webkit-scrollbar {
  width: 4px;
}

.campaign-detail__rail::-webkit-scrollbar-thumb {
  background: var(--bg-overlay);
  border-radius: 2px;
}

.campaign-detail__title-block {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.campaign-detail__title {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 1.625rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.15;
  letter-spacing: -0.005em;
}

.campaign-detail__byline {
  margin: 6px 0 0;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.campaign-detail__creator-name {
  color: var(--text-secondary);
  font-weight: 500;
}

.campaign-detail__badge-row {
  margin: 8px 0 0;
}

.campaign-detail__taxonomy,
.campaign-detail__traits {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  line-height: 1.5;
}

.campaign-detail__taxonomy {
  margin: 10px 0 0;
}

.campaign-detail__traits {
  margin: 3px 0 0;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--text-tertiary);
}

.campaign-detail__taxonomy :deep(.campaign-tag) {
  font-size: 0.625rem;
  letter-spacing: 0.12em;
  white-space: nowrap;
}

.campaign-detail__trait {
  white-space: nowrap;
}

.campaign-detail__taxonomy :deep(.campaign-tag + .campaign-tag)::before,
.campaign-detail__trait + .campaign-detail__trait::before {
  content: '·';
  margin: 0 6px;
  font-weight: 400;
  letter-spacing: 0;
  color: var(--text-tertiary);
}

.campaign-detail__difficulty--fade {
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.campaign-detail__mode {
  margin: 10px 0 0;
  font-family: var(--font-sans);
  font-size: var(--text-body);
  color: var(--text-primary);
  line-height: 1.5;
}

.campaign-detail__summary {
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--text-body);
  color: var(--text-secondary);
  line-height: 1.55;
}

.campaign-detail__vote {
  align-self: flex-start;
}

.campaign-detail__actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  align-items: flex-start;
}

.campaign-detail__actions > * {
  width: 100%;
}

.campaign-detail__hint {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  line-height: 1.4;
}

.campaign-detail__status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font-family: var(--font-sans);
  font-size: var(--text-body);
  font-weight: 600;
  color: var(--success);
  background: color-mix(in srgb, var(--success) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--success) 35%, transparent);
  border-radius: 4px;
}

.campaign-detail__manage {
  width: auto;
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  padding: 0;
  background: none;
  border: none;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: color 120ms ease;
}

.campaign-detail__manage:hover {
  color: var(--text-primary);
}

.campaign-detail__error {
  margin: 0;
  padding: 8px 12px;
  font-size: var(--text-caption);
  color: var(--error);
  background: color-mix(in srgb, var(--error) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--error) 35%, transparent);
  border-radius: 4px;
}

.campaign-detail__progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.campaign-detail__progress--spectating {
  padding: var(--space-sm) var(--space-sm) 10px;
  border: 1px solid color-mix(in srgb, var(--page-accent) 40%, var(--bg-overlay));
  border-radius: 4px;
}

.campaign-detail__progress-subject {
  margin: 0 0 2px;
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.campaign-detail__progress-meta {
  display: flex;
  flex-wrap: wrap;
  margin: 2px 0 0;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  color: var(--text-tertiary);
  line-height: 1.5;
}

.campaign-detail__progress-meta span + span::before {
  content: '·';
  margin: 0 6px;
  color: var(--text-tertiary);
}

.campaign-detail__progress-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-sm);
}

.campaign-detail__progress-label {
  font-family: var(--font-sans);
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.campaign-detail__progress-count {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  font-family: var(--font-mono);
  color: var(--text-primary);
}

.campaign-detail__progress-num {
  font-size: 1.5rem;
  font-weight: 500;
}

.campaign-detail__progress-sep {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.campaign-detail__progress-total {
  font-size: 0.9375rem;
  color: var(--text-secondary);
}

.campaign-detail__progress-track {
  position: relative;
  height: 3px;
  background: var(--bg-overlay);
  border-radius: 1px;
  overflow: hidden;
}

.campaign-detail__progress-fill {
  position: absolute;
  inset: 0;
  transform-origin: left center;
  transition: transform 320ms cubic-bezier(0.25, 1, 0.5, 1);
  will-change: transform;
}

.campaign-detail__progress-foot {
  display: flex;
  justify-content: space-between;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  color: var(--text-tertiary);
  letter-spacing: 0.04em;
}

.campaign-detail__brief,
.campaign-detail__rewards-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.campaign-detail__section-label {
  margin: 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-family: var(--font-sans);
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.campaign-detail__label-notice,
.campaign-detail__xp-note {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.campaign-detail__brief-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  padding: 0;
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  text-align: left;
  transition: color 120ms ease;
}

.campaign-detail__brief-toggle:hover {
  color: var(--text-secondary);
}

.campaign-detail__brief-chevron {
  transition: transform 160ms ease;
}

.campaign-detail__brief-chevron--open {
  transform: rotate(180deg);
}

.campaign-detail__notes {
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  font-style: italic;
  line-height: 1.55;
}

.campaign-detail__rewards-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
}

.campaign-detail__reward {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 6px 0;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  border-bottom: 1px solid var(--bg-overlay);
}

.campaign-detail__reward--withheld {
  position: relative;
}

.campaign-detail__reward--withheld :deep(.reward-item) {
  opacity: 0.55;
}

.campaign-detail__reward-hold {
  position: absolute;
  top: 2px;
  left: -6px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  color: var(--warning);
  background: var(--bg-elevated);
  border: 1px solid var(--warning);
  border-radius: 50%;
}

.campaign-detail__reward-pending {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid color-mix(in srgb, var(--warning) 40%, transparent);
  border-radius: 3px;
  background: color-mix(in srgb, var(--warning) 8%, transparent);
}

.campaign-detail__reward-pending p {
  margin: 0;
  font-size: var(--text-caption);
  line-height: 1.45;
  color: var(--text-secondary);
}

.campaign-detail__reward-pending p:first-child {
  color: var(--text-primary);
}

.campaign-detail__reward:last-child {
  border-bottom: none;
}

.campaign-detail__node {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: 4px;
  transition: border-color 160ms ease;
}

.campaign-detail__node--hovered {
  border-color: var(--text-tertiary);
  border-style: dashed;
}

.campaign-detail__node--cleared {
  border-color: color-mix(in srgb, var(--success) 35%, var(--bg-overlay));
}

.campaign-detail__node--locked {
  opacity: 0.75;
}

.campaign-detail__node-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.campaign-detail__node-eyebrow {
  font-family: var(--font-sans);
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.campaign-detail__node-state {
  font-family: var(--font-sans);
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.campaign-detail__node-state--done {
  color: var(--success);
}

.campaign-detail__node-state--locked {
  color: var(--text-tertiary);
}

.campaign-detail__node-song {
  display: flex;
  gap: var(--space-sm);
  align-items: flex-start;
}

.campaign-detail__node-cover {
  width: 64px;
  height: 64px;
  border-radius: 4px;
  overflow: hidden;
  background: var(--bg-elevated);
  flex-shrink: 0;
}

.campaign-detail__node-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.campaign-detail__node-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.campaign-detail__node-title {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.2;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.campaign-detail__node-artist {
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.campaign-detail__node-sep {
  color: var(--text-tertiary);
  padding: 0 2px;
}

.campaign-detail__node-badges {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
  margin-top: 4px;
  font-size: var(--text-caption);
}

.campaign-detail__node-badge-sep {
  color: var(--text-tertiary);
}

.campaign-detail__node-char {
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
}


.campaign-detail__targets {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-sm);
  padding: var(--space-sm) 0 0;
  border-top: 1px solid var(--bg-overlay);
}

.campaign-detail__target {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.campaign-detail__target-label {
  font-family: var(--font-sans);
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.campaign-detail__target-value {
  font-family: var(--font-mono);
  font-size: 1.0625rem;
  font-weight: 500;
  color: var(--text-primary);
}

.campaign-detail__objective-table {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}

.campaign-detail__objective-table tbody th {
  width: 100%;
  padding: 5px 0;
  text-align: left;
  font-family: var(--font-sans);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-secondary);
  white-space: nowrap;
}

.campaign-detail__objective-table tbody tr + tr th,
.campaign-detail__objective-table tbody tr + tr td {
  border-top: 1px solid color-mix(in srgb, var(--bg-overlay) 55%, transparent);
}

.campaign-detail__objective-tick {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  margin-right: 5px;
  vertical-align: -1px;
  color: var(--success);
}

.campaign-detail__objective-tick::before {
  content: '';
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--text-tertiary);
}

.campaign-detail__objective-tick--met::before {
  display: none;
}

.campaign-detail__objective-row--met th {
  color: var(--text-primary);
}

.campaign-detail__objective-goal,
.campaign-detail__objective-you {
  padding: 5px 0 5px var(--space-sm);
  text-align: right;
  font-family: var(--font-mono);
  white-space: nowrap;
  vertical-align: baseline;
}

.campaign-detail__objective-goal {
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.05;
  letter-spacing: -0.01em;
}

.campaign-detail__objective-goal--wide {
  font-size: 0.9375rem;
}

.campaign-detail__objective-you {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.campaign-detail__objective-you-who {
  font-family: var(--font-sans);
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  margin-right: 3px;
}

.campaign-detail__objective-row--met .campaign-detail__objective-you {
  color: var(--success);
}

.campaign-detail__mods,
.campaign-detail__objectives,
.campaign-detail__prereqs,
.campaign-detail__node-rewards {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.campaign-detail__prereq-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.campaign-detail__prereq {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  font-family: var(--font-sans);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
  cursor: pointer;
  transition: color 120ms ease, border-color 120ms ease;
}

.campaign-detail__prereq:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.campaign-detail__prereq-tick {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: 1px solid var(--bg-overlay);
  border-radius: 2px;
  color: transparent;
}

.campaign-detail__prereq--done .campaign-detail__prereq-tick {
  color: var(--success);
  border-color: color-mix(in srgb, var(--success) 50%, var(--bg-overlay));
  background: color-mix(in srgb, var(--success) 10%, transparent);
}

.campaign-detail__prereq--done {
  color: var(--success);
}

.campaign-detail__node-xp {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--page-accent);
  text-transform: none;
  letter-spacing: 0;
}

.campaign-detail__node-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  padding: 6px 0;
  font-family: var(--font-sans);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--page-accent);
  text-decoration: none;
  border-bottom: 1px solid color-mix(in srgb, var(--page-accent) 35%, transparent);
  transition: color 120ms ease, border-color 120ms ease;
}

.campaign-detail__node-link:hover {
  color: var(--text-primary);
  border-bottom-color: var(--text-primary);
}

.campaign-detail__placeholder {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-md);
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  text-align: center;
  border: 1px dashed var(--bg-overlay);
  border-radius: 4px;
}

@media (max-width: 1100px) {
  .campaign-detail__floats {
    inset: var(--space-sm);
    grid-template-columns: minmax(0, 320px) 1fr minmax(0, 320px);
    gap: var(--space-sm);
  }
}

@media (max-width: 860px) {
  .campaign-detail {
    position: static;
    inset: auto;
    overflow: visible;
  }

  .campaign-detail__topbar {
    right: var(--space-md);
    flex-wrap: wrap;
    gap: var(--space-sm);
  }

  .campaign-detail__spectate {
    flex-wrap: wrap;
    row-gap: 4px;
  }

  .campaign-detail__spectate-rule {
    display: none;
  }

  .campaign-detail__canvas {
    position: relative;
    height: clamp(360px, 55vh, 560px);
  }

  .campaign-detail__floats {
    position: relative;
    inset: auto;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-md);
    padding: var(--space-md);
    pointer-events: auto;
  }

  .campaign-detail__rail {
    grid-column: 1;
    max-height: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .campaign-detail__progress-fill,
  .campaign-detail__node {
    transition: none;
  }

  .campaign-detail__spectate-fade-enter-active,
  .campaign-detail__spectate-fade-leave-active {
    transition: none;
  }
}
</style>
