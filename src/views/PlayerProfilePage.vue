<script setup lang="ts">
import { getApiErrorMessage } from '@/api/client'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseTabs from '@/components/common/BaseTabs.vue'
import SearchBox from '@/components/common/SearchBox.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import StatBlock from '@/components/common/StatBlock.vue'
import ApToNextTooltip from '@/components/domain/ApToNextTooltip.vue'
import CategoryTabs from '@/components/domain/CategoryTabs.vue'
import CountryFlag from '@/components/domain/CountryFlag.vue'
import LevelBadge from '@/components/domain/LevelBadge.vue'
import NameHistoryPopover from '@/components/domain/NameHistoryPopover.vue'
import PinnedScoresSection from '@/components/domain/PinnedScoresSection.vue'
import ProfileBadgesRow from '@/components/domain/ProfileBadgesRow.vue'
import ProfileBioEditor from '@/components/domain/ProfileBioEditor.vue'
import ProfileXpTrend from '@/components/domain/ProfileXpTrend.vue'
import RelationActions from '@/components/domain/RelationActions.vue'
import RelationCountsBar from '@/components/domain/RelationCountsBar.vue'
import SupporterProfileSection from '@/components/domain/SupporterProfileSection.vue'
import { useSupporter } from '@/composables/useSupporter'
import PageHeader from '@/components/layout/PageHeader.vue'
import { useAppearance } from '@/composables/useAppearance'
import { useNameSyncSetting } from '@/composables/useNameSyncSetting'
import { usePageMeta } from '@/composables/usePageMeta'
import { useAuthStore } from '@/stores/auth'
import { useCategoryStore } from '@/stores/categories'
import { useInventoryStore } from '@/stores/inventory'
import { useRelationsStore } from '@/stores/relations'
import type { EquippedItemsResponse, UserItemResponse } from '@/types/api/items'
import type { LevelResponse, PinnedScoreResponse, StatsDiffResponse, UserAllStatisticsResponse, UserCategoryStatisticsResponse, UserResponse } from '@/types/api/users'
import type { CategoryCode } from '@/types/display'
import { useEquippedRenderProps } from '@/composables/useEquippedRenderProps'
import { getRankClass } from '@/utils/ranking'
import { pickAvatarUrl } from '@/composables/useAvatarFallback'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ProfileInventoryTab from './profile/ProfileInventoryTab.vue'
import ProfileMilestonesTab from './profile/ProfileMilestonesTab.vue'
import ProfileScoresTab from './profile/ProfileScoresTab.vue'
import ProfileStatisticsTab from './profile/ProfileStatisticsTab.vue'
import ProfileStatsChart from './profile/ProfileStatsChart.vue'

const route = useRoute()
const router = useRouter()
const categoryStore = useCategoryStore()
const authStore = useAuthStore()
const relationsStore = useRelationsStore()
const inventoryStore = useInventoryStore()
const { hideReloadedProfileFeatures, showStatisticsChart } = useAppearance()

const userId = computed(() => route.params.userId as string)

const isBlockedByMe = computed(() => relationsStore.hasRelation(userId.value, 'blocked'))

const canSnipe = computed(
  () =>
    authStore.isLoggedIn
    && !!authStore.userId
    && authStore.userId !== userId.value
    && !isBlockedByMe.value,
)

const user = ref<UserResponse | null>(null)
const userAvatarUrl = computed(() => pickAvatarUrl(user.value))
const level = ref<LevelResponse | null>(null)
const stats = ref<UserCategoryStatisticsResponse[]>([])
const xpStats = ref<UserAllStatisticsResponse | null>(null)
const statsDiff = ref<StatsDiffResponse | null>(null)
const localEquipped = ref<EquippedItemsResponse>({})
const ownedBadges = ref<UserItemResponse[]>([])
const loading = ref(true)
const error = ref(false)

const isSelfProfile = computed(
  () => authStore.isLoggedIn && authStore.userId !== null && authStore.userId === userId.value,
)

const { state: supporterState } = useSupporter(() => userId.value)

const profileOwnerTier = computed(
  () => user.value?.supporterTier ?? supporterState.value?.currentTier ?? null,
)
const isProfileOwnerSupporter = computed(() => profileOwnerTier.value != null)
const pinnedSlotLimit = computed(() => (isProfileOwnerSupporter.value ? 6 : 3))
const bioCharLimit = computed(() => (isProfileOwnerSupporter.value ? 8000 : 4000))

const equipped = computed<EquippedItemsResponse>(() => {
  if (isSelfProfile.value && inventoryStore.equippedUserId === userId.value) {
    return inventoryStore.equipped
  }
  return localEquipped.value
})

const {
  titleValue: equippedTitleValue,
  borderShapeValue: equippedBorderShapeValue,
  borderColorValue: equippedBorderColorValue,
  titleEffects: equippedTitleEffects,
  borderEffects: equippedBorderEffects,
  backgroundValue: equippedBackgroundValue,
  backgroundUrl: equippedBackgroundUrl,
  backgroundIsVideo: equippedBackgroundIsVideo,
  backgroundImageUrl: equippedBackgroundImageUrl,
  backgroundStyle: equippedBackgroundStyle,
} = useEquippedRenderProps(equipped, { previewable: true })

const equippedBackgroundFitClass = computed(() =>
  equippedBackgroundValue.value?.fit ? `profile-page__bg-equipped--${equippedBackgroundValue.value.fit}` : '',
)

const activeTab = ref(route.query.inventoryHighlight ? 'inventory' : 'scores')
const initialCategory = (route.query.category as CategoryCode) || 'overall'
const activeCategory = ref<CategoryCode>(initialCategory === 'xp' ? 'overall' : initialCategory)

watch(() => route.query.category, (newQueryCategory) => {
  const newCategory = (newQueryCategory as CategoryCode) || 'overall'
  const resolvedCategory = newCategory === 'xp' ? 'overall' : newCategory
  if (activeCategory.value !== resolvedCategory) {
    activeCategory.value = resolvedCategory
  }
})

const scoreSearch = ref('')
const editMode = ref(false)
const nameDraft = ref('')
const nameSaving = ref(false)
const nameError = ref<string | null>(null)
const nameInputRef = ref<HTMLInputElement | null>(null)

const {
  enabled: syncEnabled,
  saving: syncSaving,
  resyncQueued: syncResyncQueued,
  fetch: fetchSyncSetting,
  set: setSyncName,
  reset: resetSyncNotice,
} = useNameSyncSetting()

function enterEditMode() {
  if (!user.value) return
  nameDraft.value = user.value.name
  nameError.value = null
  editMode.value = true
  fetchSyncSetting()
}

function exitEditMode() {
  editMode.value = false
  nameError.value = null
  resetSyncNotice()
}

async function saveName() {
  if (!user.value) return
  const trimmed = nameDraft.value.trim()
  if (!trimmed) {
    nameError.value = 'Name cannot be empty.'
    return
  }
  if (trimmed.length > 64) {
    nameError.value = 'Name must be 64 characters or fewer.'
    return
  }
  if (trimmed === user.value.name) {
    nameInputRef.value?.blur()
    return
  }
  nameSaving.value = true
  nameError.value = null
  try {
    const { updateMyProfile } = await import('@/api/users')
    await updateMyProfile({ name: trimmed })
    user.value = { ...user.value, name: trimmed }
    nameInputRef.value?.blur()
    fetchSyncSetting()
  } catch (err) {
    nameError.value = getApiErrorMessage(err, 'Could not save your name.')
  } finally {
    nameSaving.value = false
  }
}

function cancelNameEdit() {
  if (!user.value) return
  nameDraft.value = user.value.name
  nameError.value = null
  nameInputRef.value?.blur()
}

function onBioSaved(bio: string) {
  if (!user.value) return
  user.value = { ...user.value, bio }
}

const pinnedScores = ref<PinnedScoreResponse[]>([])
const pinnedLoading = ref(false)
const pinPending = ref<Set<string>>(new Set())

const pinnedScoreIds = computed(() => new Set(pinnedScores.value.map((p) => p.score.id)))
const canPinMore = computed(() => pinnedScores.value.length < pinnedSlotLimit.value)

async function fetchPinnedScores() {
  pinnedLoading.value = true
  try {
    const { getUserPinnedScores } = await import('@/api/users')
    pinnedScores.value = await getUserPinnedScores(userId.value)
  } catch {
    pinnedScores.value = []
  }
  pinnedLoading.value = false
}

function buildPinnedPayload(
  ids: string[],
  commentOverride?: { scoreId: string, comment: string | null },
) {
  const existingCommentByScoreId = new Map(
    pinnedScores.value.map((p) => [p.score.id, p.comment]),
  )
  return ids.map((id, displayOrder) => {
    const comment = commentOverride?.scoreId === id
      ? commentOverride.comment
      : existingCommentByScoreId.get(id) ?? null
    return { scoreId: id, displayOrder, comment }
  })
}

async function onPinToggle(scoreId: string) {
  if (!isSelfProfile.value) return
  if (pinPending.value.has(scoreId)) return
  const currentIds = pinnedScores.value.map((p) => p.score.id)
  const isCurrentlyPinned = currentIds.includes(scoreId)
  const nextIds = isCurrentlyPinned
    ? currentIds.filter((id) => id !== scoreId)
    : [...currentIds, scoreId]
  if (nextIds.length > pinnedSlotLimit.value) return

  pinPending.value = new Set([...pinPending.value, scoreId])
  try {
    const { updateMyProfile } = await import('@/api/users')
    await updateMyProfile({ pinnedScores: buildPinnedPayload(nextIds) })
    await fetchPinnedScores()
  } catch {
  } finally {
    const next = new Set(pinPending.value)
    next.delete(scoreId)
    pinPending.value = next
  }
}

async function onUnpinFromCard(scoreId: string) {
  await onPinToggle(scoreId)
}

async function onUpdateComment(payload: { scoreId: string, comment: string | null }) {
  if (!isSelfProfile.value) return
  const currentIds = pinnedScores.value.map((p) => p.score.id)
  if (!currentIds.includes(payload.scoreId)) return
  try {
    const { updateMyProfile } = await import('@/api/users')
    await updateMyProfile({
      pinnedScores: buildPinnedPayload(currentIds, payload),
    })
    await fetchPinnedScores()
  } catch {
  }
}

const profileTabs = [
  { key: 'scores', label: 'Scores' },
  { key: 'statistics', label: 'Statistics' },
  { key: 'milestones', label: 'Milestones' },
  { key: 'inventory', label: 'Inventory' },
]

const activeStats = computed(() => {
  if (!Array.isArray(stats.value) || stats.value.length === 0) return null
  const categoryId = categoryStore.getCategoryId(activeCategory.value)
  return stats.value.find((s) => s.categoryId === categoryId) ?? null
})

const accent = computed(() => categoryStore.getAccent(activeCategory.value))

async function fetchStatsDiff() {
  try {
    const { getUserStatsDiff } = await import('@/api/users')
    statsDiff.value = await getUserStatsDiff(userId.value, activeCategory.value)
  } catch {
    statsDiff.value = null
  }
}

const breadcrumbs = computed(() => [
  { label: 'Leaderboards', to: '/leaderboards' },
  { label: user.value?.name ?? 'Player' },
])

const metaTitle = computed(() => {
  if (!user.value) return undefined
  return `${user.value.name} | AccSaber`
})

usePageMeta({ title: metaTitle })

const globalRankRoute = computed(() => {
  const ranking = activeStats.value?.ranking
  if (!ranking) return null
  const page = Math.ceil(ranking / 50)
  return {
    name: 'leaderboards-category',
    params: { categoryCode: activeCategory.value },
    query: { page: String(page), highlight: userId.value },
  }
})

const countryRankRoute = computed(() => {
  const ranking = activeStats.value?.countryRanking
  if (!ranking || !user.value) return null
  const page = Math.ceil(ranking / 50)
  return {
    name: 'leaderboards-category',
    params: { categoryCode: activeCategory.value },
    query: { country: user.value.country, page: String(page), highlight: userId.value },
  }
})

function navigateToGlobalRank() {
  if (globalRankRoute.value) router.push(globalRankRoute.value)
}

function navigateToCountryRank() {
  if (countryRankRoute.value) router.push(countryRankRoute.value)
}

async function fetchProfile() {
  loading.value = true
  error.value = false
  user.value = null
  level.value = null
  stats.value = []
  xpStats.value = null
  localEquipped.value = {}
  ownedBadges.value = []
  pinnedScores.value = []
  pinPending.value = new Set()

  try {
    const { getUser, getUserLevel, getUserAllStatistics } = await import('@/api/users')

    const userRes = await getUser(userId.value)
    user.value = userRes

    if (userRes.banned || isBlockedByMe.value) {
      loading.value = false
      return
    }

    const itemsApi = await import('@/api/items')
    const equippedPromise = isSelfProfile.value
      ? inventoryStore.fetchEquipped(userId.value, true)
      : itemsApi.getUserEquippedItems(userId.value)
    const [levelRes, allStatsRes, equippedRes, badgesRes] = await Promise.allSettled([
      getUserLevel(userId.value),
      getUserAllStatistics(userId.value),
      equippedPromise,
      itemsApi.getUserItems(userId.value, { typeKey: 'badge' }),
    ])

    if (levelRes.status === 'fulfilled') {
      level.value = levelRes.value
    }
    if (allStatsRes.status === 'fulfilled') {
      xpStats.value = allStatsRes.value
      stats.value = allStatsRes.value.categories
    }
    if (equippedRes.status === 'fulfilled' && !isSelfProfile.value) {
      localEquipped.value = (equippedRes.value as EquippedItemsResponse) ?? {}
    }
    if (badgesRes.status === 'fulfilled') {
      ownedBadges.value = badgesRes.value
    }

    fetchStatsDiff()
    fetchPinnedScores()
  } catch {
    error.value = true
    user.value = null
    level.value = null
    stats.value = []
    xpStats.value = null
    localEquipped.value = {}
    ownedBadges.value = []
    pinnedScores.value = []
  }
  loading.value = false
}

watch(userId, () => { fetchProfile() }, { immediate: true })

watch(
  () => isSelfProfile.value && inventoryStore.equippedUserId === userId.value
    ? inventoryStore.equipped
    : null,
  async () => {
    if (!isSelfProfile.value || !user.value) return
    try {
      const { getUserItems } = await import('@/api/items')
      ownedBadges.value = await getUserItems(userId.value, { typeKey: 'badge' })
    } catch {
    }
  },
  { deep: true },
)
watch(isBlockedByMe, (blocked, wasBlocked) => {
  if (blocked === wasBlocked) return
  fetchProfile()
})
watch(activeCategory, (newCategory) => {
  if (user.value) fetchStatsDiff()

  const queryCategory = (route.query.category as CategoryCode) || 'overall'
  if (queryCategory === newCategory) return

  const query = { ...route.query }
  if (newCategory === 'overall') {
    delete query.category
  } else {
    query.category = newCategory
  }
  delete query.page
  router.replace({ query })
})
</script>

<template>
  <div class="profile-page" :style="{ '--page-accent': accent }">
    <template v-if="loading">
      <div class="profile-page__skeleton-hero">
        <SkeletonLoader variant="avatar" width="96px" height="96px" />
        <SkeletonLoader variant="text" width="200px" />
        <SkeletonLoader variant="text" width="120px" />
        <div class="profile-page__skeleton-stats">
          <SkeletonLoader v-for="i in 4" :key="i" variant="stat-block" />
        </div>
      </div>
    </template>

    <template v-else-if="error || !user">
      <PageHeader title="Player Not Found" />
      <p class="profile-page__error">Could not load this player's profile.</p>
    </template>

    <template v-else>
      <nav class="profile-page__breadcrumbs" aria-label="Breadcrumb">
        <span class="profile-page__breadcrumbs-pill">
          <router-link v-for="(crumb, i) in breadcrumbs" :key="i" :to="crumb.to ?? ''" class="profile-page__crumb"
            :class="{ 'profile-page__crumb--link': !!crumb.to }">
            {{ crumb.label }}
            <span v-if="i < breadcrumbs.length - 1" class="profile-page__crumb-sep">/</span>
          </router-link>
        </span>
      </nav>

      <div class="profile-page__bg">
        <video
          v-if="equippedBackgroundIsVideo && equippedBackgroundUrl"
          class="profile-page__bg-equipped"
          :class="equippedBackgroundFitClass"
          :src="equippedBackgroundUrl"
          :style="equippedBackgroundStyle"
          autoplay
          loop
          muted
          playsinline
        />
        <div
          v-else-if="equippedBackgroundImageUrl"
          class="profile-page__bg-equipped"
          :class="equippedBackgroundFitClass"
          :style="{ ...equippedBackgroundStyle, backgroundImage: `url(${equippedBackgroundImageUrl})` }"
        />
        <div v-else class="profile-page__bg-image" :style="{ backgroundImage: `url(${userAvatarUrl})` }" />
      </div>

      <div class="profile-hero">
        <div class="profile-hero__level-col">
          <LevelBadge :level="level?.level ?? 0" :current-xp="level?.xpForCurrentLevel ?? 0"
            :required-xp="level?.xpForNextLevel ?? 1" :avatar-url="userAvatarUrl"
            :plain="hideReloadedProfileFeatures"
            :fallback-title="level?.title"
            :equipped-title="equippedTitleValue"
            :equipped-border-shape="equippedBorderShapeValue"
            :equipped-border-color="equippedBorderColorValue"
            :title-effects="equippedTitleEffects"
            :border-effects="equippedBorderEffects" />
          <ProfileXpTrend v-if="!user.banned && !hideReloadedProfileFeatures" :stats-diff="statsDiff" />
        </div>

        <div class="profile-hero__details">
          <div class="profile-hero__top-row">
            <div class="profile-hero__name-col">
              <div class="profile-hero__name-row">
                <template v-if="editMode && isSelfProfile">
                  <input ref="nameInputRef" v-model="nameDraft" type="text" maxlength="64"
                    class="profile-hero__name profile-hero__name-input"
                    :class="{ 'profile-hero__name-input--error': !!nameError }"
                    :disabled="nameSaving" aria-label="Edit display name"
                    @keydown.enter.prevent="saveName" @keydown.escape.prevent="cancelNameEdit" />
                </template>
                <template v-else>
                  <h1 class="profile-hero__name">{{ user.name }}</h1>
                  <NameHistoryPopover :user-id="userId" :current-name="user.name" />
                </template>
                <CountryFlag :country="user.country" />
                <span v-if="user.playerInactive && !user.banned" class="profile-hero__inactive-badge">Inactive</span>
              </div>
              <p v-if="editMode && nameError" class="profile-hero__name-error">{{ nameError }}</p>
              <p v-else-if="editMode && isSelfProfile" class="profile-hero__name-hint">Press Enter to save your name.</p>

              <div v-if="editMode && isSelfProfile && syncEnabled !== null" class="profile-hero__sync">
                <label class="profile-hero__sync-row">
                  <input type="checkbox" class="profile-hero__sync-check"
                    :checked="syncEnabled" :disabled="syncSaving"
                    @change="setSyncName(($event.target as HTMLInputElement).checked)" />
                  <span class="profile-hero__sync-label">Sync display name from BeatLeader / ScoreSaber</span>
                </label>
                <p class="profile-hero__sync-help">
                  When off, your custom name stays put. When on, your platform name overwrites it once a day.
                </p>
                <p v-if="syncResyncQueued" class="profile-hero__sync-notice">
                  Will resync on next refresh (4 AM daily).
                </p>
              </div>
              <ProfileBadgesRow v-if="ownedBadges.length" :badges="ownedBadges" class="profile-hero__badges" />
              <SupporterProfileSection
                v-if="supporterState"
                :state="supporterState"
                :is-self-profile="isSelfProfile"
                class="profile-hero__supporter"
              />
            </div>

            <div class="profile-hero__top-right">
              <div class="profile-hero__links">
                <BaseButton v-if="isSelfProfile" size="sm"
                  :aria-label="editMode ? 'Exit edit mode' : 'Edit profile'"
                  :title="editMode ? 'Exit edit mode' : 'Edit profile'"
                  :variant="editMode ? 'primary' : 'default'"
                  @click="editMode ? exitEditMode() : enterEditMode()">
                  <svg v-if="editMode" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
                  </svg>
                </BaseButton>
                <BaseButton size="sm" :href="`https://www.beatleader.com/u/${user.blId ?? user.id}`"
                  aria-label="View on BeatLeader">
                  <img src="https://beatleader.com/assets/favicon-32x32.png" alt="BeatLeader" width="16" height="16"
                    style="border-radius: 3px;" decoding="async" />
                </BaseButton>
                <BaseButton size="sm" :href="`https://scoresaber.com/u/${user.ssId ?? user.id}`"
                  aria-label="View on ScoreSaber">
                  <img src="https://scoresaber.com/favicon-32x32.png" alt="ScoreSaber" width="16" height="16"
                    style="border-radius: 3px;" decoding="async" />
                </BaseButton>
                <BaseButton v-if="canSnipe" size="sm" variant="primary"
                  aria-label="Snipe this player" title="Snipe this player"
                  @click="router.push({ name: 'player-snipe', params: { userId: userId } })">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <circle cx="12" cy="12" r="3" />
                    <line x1="12" y1="2" x2="12" y2="6" />
                    <line x1="12" y1="18" x2="12" y2="22" />
                    <line x1="2" y1="12" x2="6" y2="12" />
                    <line x1="18" y1="12" x2="22" y2="12" />
                  </svg>
                  <span>Snipe</span>
                </BaseButton>
                <RelationActions :target-user-id="userId" :target-name="user.name" />
              </div>
            </div>
          </div>

          <div v-if="user.banned" class="profile-hero__banned">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
            <span>This account is banned.</span>
          </div>

          <div v-else-if="isBlockedByMe" class="profile-hero__banned">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
            <span>You have blocked this user. Their stats and scores are hidden.</span>
          </div>

          <template v-else>
            <div class="profile-hero__category-tabs">
              <CategoryTabs :model-value="activeCategory" :exclude="['xp']"
                @update:model-value="activeCategory = $event" />
            </div>

            <div class="profile-hero__stats">
              <StatBlock label="Total AP" :value="activeStats?.ap ?? 0" :trend="statsDiff?.apDiff">
                <template #label-suffix>
                  <ApToNextTooltip :user-id="userId" :category="activeCategory" />
                </template>
              </StatBlock>
              <div class="profile-hero__rank-block profile-hero__rank-block--clickable" role="button" tabindex="0"
                aria-label="View on global leaderboard" @click="navigateToGlobalRank"
                @keydown.enter="navigateToGlobalRank">
                <router-link v-if="globalRankRoute" :to="globalRankRoute" class="profile-hero__rank-link" tabindex="-1"
                  aria-hidden="true" />
                <StatBlock label="Global Rank" :value="activeStats?.ranking ?? 0" :decimals="0"
                  :trend="statsDiff?.rankingDiff ? -statsDiff.rankingDiff : undefined" />
                <span v-if="activeStats?.ranking && activeStats.ranking <= 3" class="profile-hero__rank-badge"
                  :class="getRankClass(activeStats.ranking)">#{{ activeStats.ranking }}</span>
              </div>
              <div class="profile-hero__rank-block profile-hero__rank-block--clickable" role="button" tabindex="0"
                aria-label="View on country leaderboard" @click="navigateToCountryRank"
                @keydown.enter="navigateToCountryRank">
                <router-link v-if="countryRankRoute" :to="countryRankRoute" class="profile-hero__rank-link"
                  tabindex="-1" aria-hidden="true" />
                <StatBlock label="Country Rank" :value="activeStats?.countryRanking ?? 0" :decimals="0"
                  :trend="statsDiff?.countryRankingDiff ? -statsDiff.countryRankingDiff : undefined" />
                <span v-if="activeStats?.countryRanking && activeStats.countryRanking <= 3"
                  class="profile-hero__rank-badge" :class="getRankClass(activeStats.countryRanking)">#{{
                    activeStats.countryRanking }}</span>
              </div>
              <StatBlock label="Ranked Plays" :value="activeStats?.rankedPlays ?? 0" :decimals="0"
                :trend="statsDiff?.rankedPlaysDiff" />
            </div>

            <RelationCountsBar v-if="user.relations" :user-id="userId" :counts="user.relations" />
          </template>
        </div>
      </div>

      <template v-if="!user.banned && !isBlockedByMe">
        <template v-if="!hideReloadedProfileFeatures">
          <section v-if="editMode && isSelfProfile" class="profile-page__bio" aria-label="Edit bio">
            <h2 class="profile-page__bio-label">About</h2>
            <ProfileBioEditor :initial-bio="user.bio ?? ''" :max-chars="bioCharLimit" :can-use-effects="isProfileOwnerSupporter" @saved="onBioSaved" @cancel="exitEditMode" />
          </section>
          <section v-else-if="user.bio" class="profile-page__bio" aria-label="About this player">
            <h2 class="profile-page__bio-label">About</h2>
            <div class="profile-page__bio-body" v-html="user.bio" />
          </section>
        </template>

        <section v-if="showStatisticsChart" class="profile-page__inline-chart" aria-label="Statistics history">
          <h2 class="profile-page__bio-label">History</h2>
          <ProfileStatsChart :user-id="userId" :category="activeCategory" />
        </section>

        <PinnedScoresSection v-if="!hideReloadedProfileFeatures" :user-id="userId" :pinned="pinnedScores"
          :loading="pinnedLoading" :is-self-profile="isSelfProfile" :max-slots="pinnedSlotLimit"
          @unpin="onUnpinFromCard" @update-comment="onUpdateComment" />

        <div class="profile-page__tabs-row">
          <BaseTabs :tabs="profileTabs" :model-value="activeTab" @update:model-value="activeTab = $event" />
          <SearchBox v-if="activeTab === 'scores'" v-model="scoreSearch" placeholder="Search maps..." />
        </div>

        <div class="profile-page__content">
          <ProfileScoresTab v-if="activeTab === 'scores'" :user-id="userId" :category="activeCategory"
            :search="scoreSearch" :is-self-profile="isSelfProfile" :pinned-score-ids="pinnedScoreIds"
            :can-pin-more="canPinMore" :pin-pending="pinPending" @pin-toggle="onPinToggle" />
          <ProfileStatisticsTab v-if="activeTab === 'statistics'" :user-id="userId" :category="activeCategory"
            :xp-stats="xpStats" />
          <ProfileMilestonesTab v-if="activeTab === 'milestones'" :user-id="userId" />
          <ProfileInventoryTab v-if="activeTab === 'inventory'" :user-id="userId" :avatar-url="userAvatarUrl" />
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.profile-page {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-lg);
  --accent: var(--page-accent, var(--accent-overall));
}

.profile-page>*:not(.profile-page__bg) {
  width: 100%;
  max-width: 1280px;
  position: relative;
  z-index: 1;
}

.profile-page__bg {
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

.profile-page__bg-image {
  position: absolute;
  inset: -80px;
  background-size: cover;
  background-position: center 20%;
  background-repeat: no-repeat;
  filter: blur(40px) brightness(0.55) saturate(1.5);
  opacity: 0.7;
  -webkit-mask-image: radial-gradient(ellipse 65% 70% at 50% 35%, transparent 0%, rgba(0, 0, 0, 0.4) 55%, black 90%);
  mask-image: radial-gradient(ellipse 65% 70% at 50% 35%, transparent 0%, rgba(0, 0, 0, 0.4) 55%, black 90%);
}

.profile-page__bg-equipped {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  object-fit: cover;
}

.profile-page__bg-equipped--cover {
  background-size: cover;
  object-fit: cover;
}

.profile-page__bg-equipped--contain {
  background-size: contain;
  object-fit: contain;
}

.profile-page__bg-equipped--tile {
  background-size: auto;
  background-repeat: repeat;
}

.profile-page__bg-equipped--center {
  background-size: auto;
  background-position: center;
  object-fit: none;
}

@media (max-width: 767px) {
  .profile-page__bg {
    top: calc(-1 * var(--space-md));
    left: calc(-1 * var(--space-md));
    right: calc(-1 * var(--space-md));
  }
}

.profile-hero {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: stretch;
  gap: var(--space-xl);
  padding: var(--space-xl) 0 var(--space-lg);
}

.profile-hero__top-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.profile-hero__top-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-xs);
}

.profile-hero__name-col {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 0;
}

.profile-hero__badges {
  justify-content: flex-start !important;
  max-width: none !important;
}

.profile-hero__supporter {
  margin-top: var(--space-sm);
  align-self: flex-start;
}

.profile-hero__category-tabs {
  display: flex;
  justify-content: flex-start;
  margin-top: var(--space-xs);
}

.profile-hero__level-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  flex-shrink: 0;
}

.profile-hero__details {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-md);
  width: 100%;
  min-width: 0;
  min-height: 100%;
}

.profile-hero__name-row {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: var(--space-sm);
}

.profile-hero__links {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: var(--space-xs);
}

.profile-hero__name {
  font-size: calc(var(--text-page-title) * 1.15);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.01em;
}

.profile-hero__name-input {
  display: inline-block;
  min-width: 200px;
  padding: 0;
  background: transparent;
  border: none;
  border-bottom: 2px dashed var(--bg-overlay);
  font-family: var(--font-sans);
  outline: none;
  transition: border-color 120ms ease;
}

.profile-hero__name-input:focus,
.profile-hero__name-input:hover {
  border-bottom-color: var(--accent);
}

.profile-hero__name-input--error,
.profile-hero__name-input--error:focus {
  border-bottom-color: var(--error);
}

.profile-hero__name-hint {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.profile-hero__name-error {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--error);
}

.profile-hero__sync {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: var(--space-xs);
  max-width: 480px;
}

.profile-hero__sync-row {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  cursor: pointer;
  font-size: var(--text-caption);
  color: var(--text-primary);
}

.profile-hero__sync-check {
  accent-color: var(--accent);
  cursor: pointer;
}

.profile-hero__sync-check:disabled {
  cursor: progress;
}

.profile-hero__sync-label {
  font-weight: 500;
}

.profile-hero__sync-help {
  margin: 0;
  padding-left: 22px;
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.profile-hero__sync-notice {
  margin: 0;
  padding-left: 22px;
  font-size: var(--text-caption);
  color: var(--accent);
}

.profile-hero__banned {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: color-mix(in srgb, var(--error) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--error) 30%, transparent);
  border-radius: var(--radius-card);
  color: var(--error);
  font-size: var(--text-body);
  font-weight: 500;
}

.profile-hero__inactive-badge {
  font-size: var(--text-caption);
  font-weight: 500;
  color: var(--text-tertiary);
  background: color-mix(in srgb, var(--bg-overlay) 60%, transparent);
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--bg-overlay);
  letter-spacing: 0.03em;
}

.profile-hero__stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
  margin-top: auto;
  border-top: 1px solid var(--bg-overlay);
  border-bottom: 1px solid var(--bg-overlay);
}

.profile-hero__stats > * + * {
  border-inline-start: 1px solid var(--bg-overlay);
}

.profile-hero__stats :deep(.stat-block) {
  padding: var(--space-md) var(--space-lg);
  gap: var(--space-xs);
}

.profile-hero__stats :deep(.stat-block__value) {
  font-size: 2rem;
  line-height: 1;
  letter-spacing: -0.01em;
}

.profile-hero__stats :deep(.stat-block__label) {
  font-size: 0.6875rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

@media (max-width: 599px) {
  .profile-hero__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .profile-hero__stats > * + * {
    border-inline-start: none;
  }

  .profile-hero__stats > *:nth-child(n + 3) {
    border-block-start: 1px solid var(--bg-overlay);
  }

  .profile-hero__stats :deep(.stat-block__value) {
    font-size: 1.625rem;
  }
}

.profile-hero__rank-block {
  position: relative;
}

.profile-hero__rank-block--clickable {
  cursor: pointer;
  transition: background-color 120ms ease;
}

.profile-hero__rank-link {
  display: block;
  position: absolute;
  inset: 0;
  z-index: 1;
}

.profile-hero__rank-block--clickable:hover {
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}

.profile-hero__rank-block--clickable:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: -1px;
}

.profile-hero__rank-badge {
  position: absolute;
  top: var(--space-xs);
  right: var(--space-xs);
  font-family: var(--font-mono);
  font-size: 0.625rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: var(--radius-pill);
  letter-spacing: 0.02em;
}

.profile-hero__rank--gold {
  background: color-mix(in srgb, var(--tier-gold) 20%, transparent);
  color: var(--tier-gold);
}

.profile-hero__rank--silver {
  background: color-mix(in srgb, var(--tier-silver) 20%, transparent);
  color: var(--tier-silver);
}

.profile-hero__rank--bronze {
  background: color-mix(in srgb, var(--tier-bronze) 20%, transparent);
  color: var(--tier-bronze);
}

.profile-page__bio {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding-block: var(--space-sm) var(--space-md);
}

.profile-page__inline-chart {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding-block: var(--space-sm) var(--space-md);
  min-width: 0;
}

.profile-page__bio-label {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  margin: 0;
}

.profile-page__bio-body {
  color: var(--text-primary);
  font-size: var(--text-body);
  line-height: 1.65;
}

.profile-page__bio-body :deep(*:first-child) {
  margin-top: 0;
}

.profile-page__bio-body :deep(*:last-child) {
  margin-bottom: 0;
}

.profile-page__bio-body :deep(h3) {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 1.4em 0 0.4em;
}

.profile-page__bio-body :deep(h4),
.profile-page__bio-body :deep(h5),
.profile-page__bio-body :deep(h6) {
  font-size: 1rem;
  font-weight: 600;
  margin: 1.2em 0 0.4em;
}

.profile-page__bio-body :deep(p) {
  margin: 0 0 0.8em;
}

.profile-page__bio-body :deep(ul),
.profile-page__bio-body :deep(ol) {
  padding-left: 1.4em;
  margin: 0 0 0.8em;
}

.profile-page__bio-body :deep(li) {
  margin-bottom: 0.2em;
}

.profile-page__bio-body :deep(blockquote) {
  margin: 0.6em 0 1em;
  padding-left: var(--space-md);
  color: var(--text-secondary);
  font-style: italic;
  border-left: 1px solid var(--bg-overlay);
}

.profile-page__bio-body :deep(code),
.profile-page__bio-body :deep(tt) {
  font-family: var(--font-mono);
  font-size: 0.9em;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--bg-elevated);
  color: var(--accent);
}

.profile-page__bio-body :deep(pre) {
  font-family: var(--font-mono);
  font-size: 0.85em;
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-card);
  background: var(--bg-elevated);
  overflow-x: auto;
  margin: 0 0 0.8em;
}

.profile-page__bio-body :deep(pre code) {
  padding: 0;
  background: transparent;
  color: var(--text-primary);
}

.profile-page__bio-body :deep(a) {
  color: var(--accent);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
  transition: opacity 120ms ease;
}

.profile-page__bio-body :deep(a:hover) {
  opacity: 0.8;
}

.profile-page__bio-body :deep(hr) {
  border: none;
  border-top: 1px solid var(--bg-overlay);
  margin: 1.2em 0;
}

.profile-page__bio-body :deep(small) {
  font-size: 0.85em;
  color: var(--text-secondary);
}

.profile-page__tabs-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
}


.profile-page__content {
  min-height: 400px;
}

.profile-page__breadcrumbs {
  display: flex;
}

.profile-page__breadcrumbs-pill {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: 0;
}

.profile-page__crumb {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  text-decoration: none;
}

.profile-page__crumb--link {
  color: var(--text-primary);
  transition: color 120ms ease;
}

.profile-page__crumb--link:hover {
  color: var(--accent);
}

.profile-page__crumb-sep {
  margin-left: var(--space-xs);
  color: var(--text-secondary);
}

.profile-page__error {
  text-align: center;
  color: var(--text-secondary);
  padding: var(--space-3xl);
}

.profile-page__skeleton-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-xl) 0;
}

.profile-page__skeleton-stats {
  display: flex;
  justify-content: center;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
}

@media (max-width: 767px) {
  .profile-hero {
    grid-template-columns: 1fr;
    justify-items: center;
    text-align: center;
    gap: var(--space-md);
    padding: var(--space-lg) 0 var(--space-md);
  }

  .profile-hero__category-tabs {
    justify-content: center;
  }

  .profile-hero__details {
    align-items: center;
  }

  .profile-hero__name-row {
    justify-content: center;
  }

  .profile-hero__name-col {
    align-items: center;
  }

  .profile-hero__badges {
    justify-content: center !important;
  }

  .profile-hero__links {
    justify-content: center;
  }

  .profile-page__tabs-row {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
