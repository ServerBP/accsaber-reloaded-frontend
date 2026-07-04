import type { CrateContentResponse } from '@/types/api/items'
import { get } from './client'

export function getCrateContents(crateItemId: string): Promise<CrateContentResponse[]> {
  return get<CrateContentResponse[]>(`/crates/${crateItemId}/contents`)
}
