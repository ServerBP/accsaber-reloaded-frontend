import type { PickerOption } from '@/components/domain/ResourcePicker.vue'
import type { JobFieldKind, LeaderboardPlatform } from '@/types/api/jobs'
import type { MilestoneResponse } from '@/types/api/milestones'
import { pickAvatarUrl, pickCoverUrl } from '@/composables/useAvatarFallback'
import { useCategoryStore } from '@/stores/categories'

export interface ResourceSource {
  search: (query: string) => Promise<PickerOption[]>
  resolve: (id: string) => Promise<PickerOption | null>
  placeholder: string
}

const SEARCH_SIZE = 20
const MILESTONE_PAGE_SIZE = 500

async function searchUsers(query: string): Promise<PickerOption[]> {
  const overallId = useCategoryStore().byCode.get('overall')?.id
  if (!overallId) return []
  const { getLeaderboard } = await import('@/api/leaderboards')
  const page = await getLeaderboard(overallId, {
    page: 0,
    size: SEARCH_SIZE,
    search: query || undefined,
    sort: 'ranking,ASC',
  })
  return page.content.map((user) => ({
    id: user.userId,
    label: user.userName,
    hint: `#${user.ranking}`,
    imageUrl: pickAvatarUrl(user),
  }))
}

async function resolveUser(id: string): Promise<PickerOption | null> {
  const { getUser } = await import('@/api/users')
  const user = await getUser(id)
  return { id: user.id, label: user.name, imageUrl: pickAvatarUrl(user) }
}

async function searchCampaigns(query: string): Promise<PickerOption[]> {
  const { getCampaigns } = await import('@/api/campaigns')
  const page = await getCampaigns({
    page: 0,
    size: SEARCH_SIZE,
    search: query || undefined,
    sort: 'name',
  })
  return page.content.map((campaign) => ({
    id: campaign.id,
    label: campaign.name,
    hint: campaign.legacy ? 'legacy' : campaign.status.toLowerCase(),
  }))
}

async function resolveCampaign(id: string): Promise<PickerOption | null> {
  const { getCampaign } = await import('@/api/campaigns')
  const campaign = await getCampaign(id)
  return { id: campaign.id, label: campaign.name }
}

async function searchDifficulties(query: string): Promise<PickerOption[]> {
  const { getDifficulties } = await import('@/api/maps')
  const page = await getDifficulties({ page: 0, size: SEARCH_SIZE, search: query || undefined })
  return page.content.map((difficulty) => ({
    id: difficulty.id,
    label: difficulty.songName,
    hint: difficulty.difficulty,
    imageUrl: pickCoverUrl(difficulty),
  }))
}

async function resolveDifficulty(id: string): Promise<PickerOption | null> {
  const { getDifficulty } = await import('@/api/maps')
  const difficulty = await getDifficulty(id)
  return {
    id: difficulty.id,
    label: difficulty.songName,
    hint: difficulty.difficulty,
    imageUrl: pickCoverUrl(difficulty),
  }
}

let milestoneCache: Promise<MilestoneResponse[]> | null = null

function loadMilestones(): Promise<MilestoneResponse[]> {
  if (!milestoneCache) {
    milestoneCache = import('@/api/milestones')
      .then((mod) => mod.getMilestones({ page: 0, size: MILESTONE_PAGE_SIZE }))
      .then((page) => [...page.content].sort((a, b) => a.title.localeCompare(b.title)))
      .catch((err) => {
        milestoneCache = null
        throw err
      })
  }
  return milestoneCache
}

function toMilestoneOption(milestone: MilestoneResponse): PickerOption {
  return { id: milestone.id, label: milestone.title, hint: milestone.tier.toLowerCase() }
}

async function searchMilestones(query: string): Promise<PickerOption[]> {
  const milestones = await loadMilestones()
  const needle = query.toLowerCase()
  const matches = needle
    ? milestones.filter((m) => m.title.toLowerCase().includes(needle))
    : milestones
  return matches.slice(0, SEARCH_SIZE).map(toMilestoneOption)
}

async function resolveMilestone(id: string): Promise<PickerOption | null> {
  const { getMilestone } = await import('@/api/milestones')
  return toMilestoneOption(await getMilestone(id))
}

export const RESOURCE_SOURCES: Partial<Record<JobFieldKind, ResourceSource>> = {
  USER: { search: searchUsers, resolve: resolveUser, placeholder: 'Search players by name...' },
  CAMPAIGN: {
    search: searchCampaigns,
    resolve: resolveCampaign,
    placeholder: 'Search campaigns by name...',
  },
  MAP_DIFFICULTY: {
    search: searchDifficulties,
    resolve: resolveDifficulty,
    placeholder: 'Search maps by song name...',
  },
  MILESTONE: {
    search: searchMilestones,
    resolve: resolveMilestone,
    placeholder: 'Search milestones by title...',
  },
}

export const LEADERBOARD_PLATFORMS: LeaderboardPlatform[] = ['BEATLEADER', 'SCORESABER']
