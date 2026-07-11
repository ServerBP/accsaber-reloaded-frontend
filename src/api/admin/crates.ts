import type {
  CrateContentResponse,
  CrateModifierResponse,
  ItemResponse,
  UnusualEffectResponse,
} from '@/types/api/items'
import { del, get, put } from '../client'

export type { CrateContentResponse, CrateModifierResponse }

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

export function getAdminCrateModifiers(crateId: string): Promise<CrateModifierResponse[]> {
  return get<CrateModifierResponse[]>(`/admin/crates/${crateId}/modifiers`)
}

export function putAdminCrateModifier(
  crateId: string,
  modifierId: string,
  dropChance: number,
): Promise<CrateModifierResponse> {
  return put<CrateModifierResponse>(`/admin/crates/${crateId}/modifiers/${modifierId}`, {
    dropChance,
  })
}

export function deleteAdminCrateModifier(crateId: string, modifierId: string): Promise<void> {
  return del<void>(`/admin/crates/${crateId}/modifiers/${modifierId}`)
}

export function getAdminCrateUnusualEffects(crateId: string): Promise<UnusualEffectResponse[]> {
  return get<UnusualEffectResponse[]>(`/admin/crates/${crateId}/unusual-effects`)
}

export function putAdminCrateUnusualEffect(
  crateId: string,
  effectId: string,
): Promise<UnusualEffectResponse> {
  return put<UnusualEffectResponse>(`/admin/crates/${crateId}/unusual-effects/${effectId}`)
}

export function deleteAdminCrateUnusualEffect(crateId: string, effectId: string): Promise<void> {
  return del<void>(`/admin/crates/${crateId}/unusual-effects/${effectId}`)
}
