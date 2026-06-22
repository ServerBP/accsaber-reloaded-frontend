import type { CampaignTagResponse } from '@/types/api/campaigns'

const TIER_ORDER = [
  'Beginner',
  'Apprentice',
  'Intermediate',
  'Advanced',
  'Expert',
  'Impossible',
] as const

const PROGRESSIVE_TAG = 'Progressive'

const TIER_COLORS: Record<string, string> = {
  Beginner: 'var(--campaign-tier-beginner)',
  Apprentice: 'var(--campaign-tier-apprentice)',
  Intermediate: 'var(--campaign-tier-intermediate)',
  Advanced: 'var(--campaign-tier-advanced)',
  Expert: 'var(--campaign-tier-expert)',
  Impossible: 'var(--campaign-tier-impossible)',
}

function tierIndex(name: string): number {
  return TIER_ORDER.indexOf(name as (typeof TIER_ORDER)[number])
}

export function isProgressiveCampaign(tags: CampaignTagResponse[]): boolean {
  return tags.some((t) => t.kind === 'DIFFICULTY' && t.name === PROGRESSIVE_TAG)
}

export function campaignDifficultyTiers(tags: CampaignTagResponse[]): CampaignTagResponse[] {
  return tags
    .filter((t) => t.kind === 'DIFFICULTY' && t.name !== PROGRESSIVE_TAG)
    .slice()
    .sort((a, b) => {
      const ai = tierIndex(a.name)
      const bi = tierIndex(b.name)
      if (ai === -1 && bi === -1) return a.name.localeCompare(b.name)
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
}

export function campaignDifficultyLabel(tags: CampaignTagResponse[]): string | null {
  const tiers = campaignDifficultyTiers(tags)
  if (tiers.length === 0) return null
  const first = tiers[0].name
  const last = tiers[tiers.length - 1].name
  return first === last ? first : `${first} - ${last}`
}

export function campaignDifficultyColor(
  tags: CampaignTagResponse[],
  fallback = 'var(--accent-overall)',
): string {
  const tiers = campaignDifficultyTiers(tags)
  if (tiers.length === 0) return fallback
  const start = TIER_COLORS[tiers[0].name] ?? fallback
  const end = TIER_COLORS[tiers[tiers.length - 1].name] ?? fallback
  const blended = isProgressiveCampaign(tags) || tiers.length > 1
  if (blended && start !== end) {
    return `color-mix(in srgb, ${start} 50%, ${end})`
  }
  return end
}

export function campaignDifficultyGradient(tags: CampaignTagResponse[]): string | null {
  const tiers = campaignDifficultyTiers(tags)
  if (tiers.length === 0) return null
  const start = TIER_COLORS[tiers[0].name]
  const end = TIER_COLORS[tiers[tiers.length - 1].name]
  if (!start || !end || start === end) return null
  return `linear-gradient(90deg, ${start} 0%, ${end} 100%)`
}
