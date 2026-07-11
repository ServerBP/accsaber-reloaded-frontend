import type {
  CreateUnusualEffectRequest,
  UnusualEffectResponse,
  UpdateUnusualEffectRequest,
} from '@/types/api/items'
import { del, get, patch, post } from '../client'

export function getAdminUnusualEffects(includeInactive = false): Promise<UnusualEffectResponse[]> {
  return get<UnusualEffectResponse[]>(
    `/admin/unusual-effects${includeInactive ? '?includeInactive=true' : ''}`,
  )
}

export function createAdminUnusualEffect(
  req: CreateUnusualEffectRequest,
): Promise<UnusualEffectResponse> {
  return post<UnusualEffectResponse>('/admin/unusual-effects', req)
}

export function updateAdminUnusualEffect(
  id: string,
  req: UpdateUnusualEffectRequest,
): Promise<UnusualEffectResponse> {
  return patch<UnusualEffectResponse>(`/admin/unusual-effects/${id}`, req)
}

export function deactivateAdminUnusualEffect(id: string): Promise<void> {
  return del<void>(`/admin/unusual-effects/${id}`)
}

export function reactivateAdminUnusualEffect(id: string): Promise<UnusualEffectResponse> {
  return post<UnusualEffectResponse>(`/admin/unusual-effects/${id}/reactivate`)
}
