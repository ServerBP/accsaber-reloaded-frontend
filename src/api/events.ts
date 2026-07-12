import type {
  EventDetailResponse,
  EventListParams,
  EventMissionProgressResponse,
  EventMissionResponse,
  EventProgressResponse,
  EventResponse,
} from '@/types/api/events'
import { get } from './client'
import { buildQuery } from './utils'

export function getEvents(params?: EventListParams): Promise<EventResponse[]> {
  return get<EventResponse[]>(`/events${buildQuery(params)}`)
}

export async function getCurrentEvent(): Promise<EventResponse | null> {
  return (await get<EventResponse | null>('/events/current')) ?? null
}

export function getEventDetail(id: string): Promise<EventDetailResponse> {
  return get<EventDetailResponse>(`/events/${id}`)
}

export function getEventMissions(id: string, week?: number): Promise<EventMissionResponse[]> {
  return get<EventMissionResponse[]>(`/events/${id}/missions${buildQuery({ week })}`)
}

export function getEventProgress(id: string): Promise<EventProgressResponse> {
  return get<EventProgressResponse>(`/events/${id}/me`)
}

export function getEventMissionsProgress(
  id: string,
  week?: number,
): Promise<EventMissionProgressResponse[]> {
  return get<EventMissionProgressResponse[]>(`/events/${id}/missions/me${buildQuery({ week })}`)
}
