import type {
  CrateContentResponse,
  CrateModifierResponse,
  CrateOpenResponse,
  UnusualEffectResponse,
} from '@/types/api/items'
import { get, post } from './client'

export function getCrateContents(crateItemId: string): Promise<CrateContentResponse[]> {
  return get<CrateContentResponse[]>(`/crates/${crateItemId}/contents`)
}

export function getCrateModifiers(crateItemId: string): Promise<CrateModifierResponse[]> {
  return get<CrateModifierResponse[]>(`/crates/${crateItemId}/modifiers`)
}

export function getCrateUnusualEffects(
  crateItemId: string,
): Promise<UnusualEffectResponse[]> {
  return get<UnusualEffectResponse[]>(`/crates/${crateItemId}/unusual-effects`)
}

export function openCrate(linkId: string): Promise<CrateOpenResponse> {
  return post<CrateOpenResponse>(`/users/me/crates/${linkId}/open`)
}
