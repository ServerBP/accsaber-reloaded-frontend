import type { MissionListParams, MissionResponse } from '@/types/api/missions'
import { get } from './client'
import { buildQuery } from './utils'

export function getMyMissions(params?: MissionListParams): Promise<MissionResponse[]> {
  return get<MissionResponse[]>(`/users/me/missions${buildQuery(params)}`)
}

export function getMyCompletedMissions(): Promise<MissionResponse[]> {
  return get<MissionResponse[]>('/users/me/missions/completed')
}
