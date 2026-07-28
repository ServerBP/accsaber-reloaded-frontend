import { patch } from '../client'
import { buildQuery } from '../utils'

export function setUserBanned(userId: string, banned: boolean): Promise<void> {
  return patch<void>(`/admin/users/${userId}/ban${buildQuery({ banned })}`)
}

export interface CountryOverrideRequest {
  country: string | null
}

export function setCountryOverride(userId: string, country: string | null): Promise<void> {
  const req: CountryOverrideRequest = { country }
  return patch<void>(`/admin/users/${userId}/country`, req)
}
