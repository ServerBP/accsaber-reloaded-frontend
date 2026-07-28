import type {
  CreateUnusualEffectRequest,
  UnusualEffectResponse,
  UpdateUnusualEffectRequest,
} from '@/types/api/items'
import { get, patch, post } from '../client'
import { buildQuery } from '../utils'

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

export function setAdminUnusualEffectActive(
  id: string,
  active: boolean,
): Promise<UnusualEffectResponse> {
  return patch<UnusualEffectResponse>(
    `/admin/unusual-effects/${id}/active${buildQuery({ active })}`,
  )
}
