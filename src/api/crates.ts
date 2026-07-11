import type {
  CrateContentResponse,
  CrateModifierResponse,
  UnusualEffectResponse,
} from '@/types/api/items'
import { get } from './client'

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
