import type { MissionListParams, MissionResponse } from '@/types/api/missions'
import { get } from '../client'
import { buildQuery } from '../utils'

export function getUserMissions(
  userId: string,
  params?: MissionListParams,
): Promise<MissionResponse[]> {
  return get<MissionResponse[]>(`/admin/missions/users/${userId}${buildQuery(params)}`)
}

export function getUserCompletedMissions(userId: string): Promise<MissionResponse[]> {
  return get<MissionResponse[]>(`/admin/missions/users/${userId}/completed`)
}
