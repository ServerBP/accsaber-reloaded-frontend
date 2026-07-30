import type {
  CampaignDetailResponse,
  CampaignDifficultyResponse,
  CampaignItemAwardResponse,
} from '@/types/api/campaigns'
import { isMilestoneNode, prereqIds } from './campaignLayout'

export const XP_PER_NODE = 100
export const NODES_PER_ITEM_AWARD = 6.5
export const NODES_PER_MILESTONE = 20

export interface CampaignAuditRef {
  id: string
  label: string
}

export interface CampaignAuditIssue {
  key: string
  message: string
  refs: CampaignAuditRef[]
}

export interface CampaignAudit {
  paysOut: boolean
  nodeCount: number
  barrierCount: number
  milestoneCount: number
  nodeXp: number
  barrierXp: number
  completionXp: number
  totalXp: number
  xpBudget: number
  avgXpPerNode: number
  minNodeXp: number
  maxNodeXp: number
  rewards: CampaignItemAwardResponse[]
  rewardCount: number
  rewardBudget: number
  issues: CampaignAuditIssue[]
}

const EMPTY_AUDIT: CampaignAudit = {
  paysOut: false,
  nodeCount: 0,
  barrierCount: 0,
  milestoneCount: 0,
  nodeXp: 0,
  barrierXp: 0,
  completionXp: 0,
  totalXp: 0,
  xpBudget: 0,
  avgXpPerNode: 0,
  minNodeXp: 0,
  maxNodeXp: 0,
  rewards: [],
  rewardCount: 0,
  rewardBudget: 0,
  issues: [],
}

function nodeRef(node: CampaignDifficultyResponse): CampaignAuditRef {
  return { id: node.id, label: node.songName || 'Untitled node' }
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function aggregateRewards(campaign: CampaignDetailResponse): CampaignItemAwardResponse[] {
  const byItem = new Map<string, CampaignItemAwardResponse>()
  const sources = [
    campaign.completionItems,
    ...campaign.difficulties.map((d) => d.items),
    ...campaign.barriers.map((b) => b.items),
  ]
  for (const award of sources.flat()) {
    const existing = byItem.get(award.itemId)
    if (existing) existing.quantity += award.quantity
    else byItem.set(award.itemId, { ...award })
  }
  return Array.from(byItem.values())
}

function findXpRegressions(campaign: CampaignDetailResponse): CampaignDifficultyResponse[] {
  const nodeById = new Map(campaign.difficulties.map((d) => [d.id, d]))
  const prereqsById = new Map<string, string[]>()
  for (const vertex of [...campaign.difficulties, ...campaign.barriers]) {
    prereqsById.set(vertex.id, prereqIds(vertex.prerequisites))
  }

  const memo = new Map<string, number>()

  function maxXpBefore(id: string, stack: Set<string>): number {
    const cached = memo.get(id)
    if (cached !== undefined) return cached
    if (stack.has(id)) return Number.NEGATIVE_INFINITY
    stack.add(id)
    let best = Number.NEGATIVE_INFINITY
    for (const prereqId of prereqsById.get(id) ?? []) {
      const node = nodeById.get(prereqId)
      if (node) best = Math.max(best, node.xp)
      best = Math.max(best, maxXpBefore(prereqId, stack))
    }
    stack.delete(id)
    memo.set(id, best)
    return best
  }

  return campaign.difficulties.filter(
    (d) => d.xp > 0 && d.xp < maxXpBefore(d.id, new Set<string>()),
  )
}

function collectIssues(
  campaign: CampaignDetailResponse,
  audit: CampaignAudit,
): CampaignAuditIssue[] {
  const issues: CampaignAuditIssue[] = []

  const emptyBarriers = campaign.barriers.filter(
    (b) => b.affectedCampaignDifficultyIds.length === 0,
  )
  if (emptyBarriers.length > 0) {
    issues.push({
      key: 'barrier-no-nodes',
      message: `${emptyBarriers.length} barrier${emptyBarriers.length === 1 ? '' : 's'} read from no nodes, so the condition has nothing to measure. Pick the affected nodes.`,
      refs: emptyBarriers.map((b) => ({ id: b.id, label: b.checkpointLabel || 'Barrier' })),
    })
  }

  const regressions = findXpRegressions(campaign)
  if (regressions.length > 0) {
    issues.push({
      key: 'xp-regression',
      message: `${regressions.length} node${regressions.length === 1 ? '' : 's'} award less XP than a node earlier on the same path.`,
      refs: regressions.map(nodeRef),
    })
  }

  const zeroXpNodes = campaign.difficulties.filter((d) => d.xp <= 0)
  if (zeroXpNodes.length > 0) {
    issues.push({
      key: 'zero-xp',
      message: `${zeroXpNodes.length} node${zeroXpNodes.length === 1 ? '' : 's'} award no XP.`,
      refs: zeroXpNodes.map(nodeRef),
    })
  }

  if (audit.totalXp > audit.xpBudget) {
    issues.push({
      key: 'xp-budget',
      message: `Total XP is ${audit.totalXp.toLocaleString()}, above the ${audit.xpBudget.toLocaleString()} recommended for ${audit.nodeCount} node${audit.nodeCount === 1 ? '' : 's'} (${XP_PER_NODE} XP per node).`,
      refs: [],
    })
  }

  if (audit.rewardCount > audit.rewardBudget) {
    issues.push({
      key: 'reward-budget',
      message: `${audit.rewardCount} item award${audit.rewardCount === 1 ? '' : 's'}, above the ${audit.rewardBudget} recommended for ${audit.nodeCount} node${audit.nodeCount === 1 ? '' : 's'} (one per ${NODES_PER_ITEM_AWARD} nodes).`,
      refs: [],
    })
  }

  const milestoneBudget = Math.floor(audit.nodeCount / NODES_PER_MILESTONE)
  if (audit.milestoneCount === 0) {
    issues.push({
      key: 'no-milestones',
      message: 'No milestones. Players get no landmark to aim for along the path.',
      refs: [],
    })
  } else if (audit.milestoneCount < milestoneBudget) {
    issues.push({
      key: 'milestone-budget',
      message: `${audit.milestoneCount} milestone${audit.milestoneCount === 1 ? '' : 's'} for ${audit.nodeCount} nodes, below the ${milestoneBudget} recommended (one per ${NODES_PER_MILESTONE} nodes).`,
      refs: [],
    })
  }

  return issues
}

export function auditCampaign(campaign: CampaignDetailResponse | null): CampaignAudit {
  if (!campaign || campaign.difficulties.length === 0) return EMPTY_AUDIT

  const nodeXpValues = campaign.difficulties.map((d) => d.xp)
  const nodeCount = campaign.difficulties.length
  const nodeXp = sum(nodeXpValues)
  const barrierXp = sum(campaign.barriers.map((b) => b.xp))
  const completionXp = campaign.completionXp
  const totalXp = nodeXp + barrierXp + completionXp
  const rewards = aggregateRewards(campaign)
  const rewardCount = sum(rewards.map((r) => r.quantity))

  const audit: CampaignAudit = {
    paysOut: totalXp > 0 || rewards.length > 0,
    nodeCount,
    barrierCount: campaign.barriers.length,
    milestoneCount: campaign.difficulties.filter(isMilestoneNode).length,
    nodeXp,
    barrierXp,
    completionXp,
    totalXp,
    xpBudget: nodeCount * XP_PER_NODE,
    avgXpPerNode: Math.round(totalXp / nodeCount),
    minNodeXp: Math.min(...nodeXpValues),
    maxNodeXp: Math.max(...nodeXpValues),
    rewards,
    rewardCount,
    rewardBudget: Math.floor(nodeCount / NODES_PER_ITEM_AWARD),
    issues: [],
  }

  audit.issues = collectIssues(campaign, audit)
  return audit
}
