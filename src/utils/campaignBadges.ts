import type { CampaignResponse } from '@/types/api/campaigns'

export type CampaignBadgeKind = 'official' | 'curated' | 'loved'

export interface CampaignBadge {
  kind: CampaignBadgeKind
  label: string
  title: string
  at: string | null
}

interface CampaignBadgeRule {
  kind: CampaignBadgeKind
  label: string
  title: string
  applies: (campaign: CampaignResponse) => boolean
  at: (campaign: CampaignResponse) => string | null
}

const BADGE_RULES: CampaignBadgeRule[] = [
  {
    kind: 'official',
    label: 'Official',
    title: 'Built by the AccSaber team.',
    applies: (c) => c.official,
    at: () => null,
  },
  {
    kind: 'curated',
    label: 'Curated',
    title: 'Curated by the campaign team. Clearing it pays out XP and items.',
    applies: (c) => c.status === 'CURATED',
    at: (c) => c.curatedAt,
  },
  {
    kind: 'loved',
    label: 'Loved',
    title: 'A community favourite picked out by the curators. It awards no XP or items.',
    applies: (c) => c.loved,
    at: (c) => c.lovedAt,
  },
]

export function campaignBadges(campaign: CampaignResponse): CampaignBadge[] {
  return BADGE_RULES.filter((rule) => rule.applies(campaign)).map((rule) => ({
    kind: rule.kind,
    label: rule.label,
    title: rule.title,
    at: rule.at(campaign),
  }))
}
