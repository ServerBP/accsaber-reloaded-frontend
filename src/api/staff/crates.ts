import type {
  CrateContentResponse,
  CrateModifierResponse,
  UnusualEffectResponse,
} from '@/types/api/items'
import { get } from '../client'

export function getStaffCrateContents(crateItemId: string): Promise<CrateContentResponse[]> {
  return get<CrateContentResponse[]>(`/staff/crates/${crateItemId}/contents`)
}

export function getStaffCrateModifiers(crateItemId: string): Promise<CrateModifierResponse[]> {
  return get<CrateModifierResponse[]>(`/staff/crates/${crateItemId}/modifiers`)
}

export function getStaffCrateUnusualEffects(crateItemId: string): Promise<UnusualEffectResponse[]> {
  return get<UnusualEffectResponse[]>(`/staff/crates/${crateItemId}/unusual-effects`)
}
