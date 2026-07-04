import type { CrateContentResponse, ItemResponse } from '@/types/api/items'
import { del, get, put } from '../client'

export type { CrateContentResponse }

export function getAdminCrates(): Promise<ItemResponse[]> {
  return get<ItemResponse[]>('/admin/crates')
}

export function getAdminCrateContents(crateId: string): Promise<CrateContentResponse[]> {
  return get<CrateContentResponse[]>(`/admin/crates/${crateId}/contents`)
}

export function putAdminCrateContent(
  crateId: string,
  rewardId: string,
  dropWeight: number,
): Promise<CrateContentResponse> {
  return put<CrateContentResponse>(`/admin/crates/${crateId}/contents/${rewardId}`, {
    dropWeight,
  })
}

export function deleteAdminCrateContent(crateId: string, rewardId: string): Promise<void> {
  return del<void>(`/admin/crates/${crateId}/contents/${rewardId}`)
}
