import type { PublicMapDifficultyResponse } from '@/types/api/maps'
import { ref } from 'vue'

export function useCampaignDifficultyMeta() {
  const difficultyMeta = ref(new Map<string, PublicMapDifficultyResponse>())

  async function loadDifficultyMeta(
    difficulties: { id: string; mapDifficultyId: string }[],
  ) {
    if (difficulties.length === 0) return
    const next = new Map(difficultyMeta.value)
    const missing = difficulties.filter((d) => !next.has(d.id))
    if (missing.length === 0) return
    const { getDifficultiesByIds } = await import('@/api/maps')
    try {
      const metas = await getDifficultiesByIds(missing.map((d) => d.mapDifficultyId))
      const byMapDifficultyId = new Map(metas.map((m) => [m.id, m]))
      for (const d of missing) {
        const meta = byMapDifficultyId.get(d.mapDifficultyId)
        if (meta) next.set(d.id, meta)
      }
      difficultyMeta.value = next
    } catch {}
  }

  return { difficultyMeta, loadDifficultyMeta }
}
