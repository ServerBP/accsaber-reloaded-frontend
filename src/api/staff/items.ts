import type {
  AdminItemListParams,
  ItemResponse,
  UnusualEffectResponse,
} from '@/types/api/items'
import { get } from '../client'
import { buildQuery } from '../utils'

export function getStaffItems(params?: AdminItemListParams): Promise<ItemResponse[]> {
  return get<ItemResponse[]>(`/staff/items${buildQuery(params)}`)
}

export function getStaffUnusualEffects(includeInactive = false): Promise<UnusualEffectResponse[]> {
  const query = buildQuery(includeInactive ? { includeInactive: true } : undefined)
  return get<UnusualEffectResponse[]>(`/staff/unusual-effects${query}`)
}
