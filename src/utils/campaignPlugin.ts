import type { CampaignDetailResponse } from '@/types/api/campaigns'
import type { BarrierConditionType, CampaignRequirementType } from '@/types/enums'

export const PLUGIN_HARD_WARNING =
  'Not readable by the current in-game plugin. Campaigns using this will fail to load in Beat Saber until a new release is available. '

export const PLUGIN_ZERO_BOUND_NOTE =
  'The plugin ignores a missing lower bound and displays this as 0 in-game until a new release is available. '

export const PLUGIN_FIRST_TARGET_NOTE =
  'The in-game plugin shows only the first objective, so players see a simpler requirement than the web does. Keep the most representative one first. '

const UNREADABLE_REQUIREMENTS = new Set<CampaignRequirementType>([
  'COMBO',
  'BOMB_HITS',
  'MISTAKES',
])

const UNREADABLE_CONDITIONS = new Set<BarrierConditionType>([
  'AVERAGE_COMBO',
  'AVERAGE_BOMB_HITS',
  'AVERAGE_MISTAKES',
])

export function isUnreadableRequirement(type: CampaignRequirementType): boolean {
  return UNREADABLE_REQUIREMENTS.has(type)
}

export function isUnreadableCondition(type: BarrierConditionType): boolean {
  return UNREADABLE_CONDITIONS.has(type)
}

export function isZeroBound(value: number | null, valueMax: number | null): boolean {
  return value == null && valueMax != null
}

export function countFractionalVertices(campaign: CampaignDetailResponse | null): number {
  if (!campaign) return 0
  const vertices = [...campaign.difficulties, ...campaign.barriers, ...campaign.texts]
  return vertices.filter(
    (v) => !Number.isInteger(v.positionX) || !Number.isInteger(v.positionY),
  ).length
}
