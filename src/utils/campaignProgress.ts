import type { CampaignDifficultyResponse } from '@/types/api/campaigns'
import { prereqIds } from './campaignLayout'

export function collectMissingPrerequisites(
  nodeId: string,
  nodesById: Map<string, CampaignDifficultyResponse>,
  isCompleted: (id: string) => boolean,
): CampaignDifficultyResponse[] {
  const satisfiedCache = new Map<string, boolean>()

  function knownPrereqIds(node: CampaignDifficultyResponse): string[] {
    return prereqIds(node.prerequisites).filter((id) => nodesById.has(id))
  }

  function pathSatisfied(id: string, stack: Set<string>): boolean {
    const cached = satisfiedCache.get(id)
    if (cached !== undefined) return cached
    if (stack.has(id)) return true
    const node = nodesById.get(id)
    if (!node) return true
    stack.add(id)
    const result = isCompleted(id) && prereqsSatisfied(node, stack)
    stack.delete(id)
    satisfiedCache.set(id, result)
    return result
  }

  function prereqsSatisfied(node: CampaignDifficultyResponse, stack: Set<string>): boolean {
    const ids = knownPrereqIds(node)
    if (ids.length === 0) return true
    if (node.prerequisiteMode === 'OR') return ids.some((id) => pathSatisfied(id, stack))
    return ids.every((id) => pathSatisfied(id, stack))
  }

  function collectBranch(
    id: string,
    stack: Set<string>,
    out: Map<string, CampaignDifficultyResponse>,
  ) {
    if (stack.has(id) || pathSatisfied(id, new Set())) return
    const node = nodesById.get(id)
    if (!node) return
    stack.add(id)
    if (!isCompleted(id)) out.set(id, node)
    collectPrereqs(node, stack, out)
    stack.delete(id)
  }

  function collectPrereqs(
    node: CampaignDifficultyResponse,
    stack: Set<string>,
    out: Map<string, CampaignDifficultyResponse>,
  ) {
    const ids = knownPrereqIds(node)
    if (ids.length === 0) return
    if (node.prerequisiteMode === 'OR') {
      if (ids.some((id) => pathSatisfied(id, new Set()))) return
      let best: Map<string, CampaignDifficultyResponse> | null = null
      for (const id of ids) {
        const candidate = new Map<string, CampaignDifficultyResponse>()
        collectBranch(id, new Set(stack), candidate)
        if (!best || candidate.size < best.size) best = candidate
      }
      if (best) for (const [id, missing] of best) out.set(id, missing)
    } else {
      for (const id of ids) collectBranch(id, stack, out)
    }
  }

  const target = nodesById.get(nodeId)
  if (!target) return []
  const out = new Map<string, CampaignDifficultyResponse>()
  collectPrereqs(target, new Set([nodeId]), out)
  return Array.from(out.values())
}
