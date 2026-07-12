import type {
  EventRequest,
  EventResponse,
  MissionTemplateResponse,
} from '@/types/api/events'
import { del, get, patch, post, postMultipart } from '../client'

export function listAllEvents(): Promise<EventResponse[]> {
  return get<EventResponse[]>('/admin/events')
}

export function getAdminEvent(id: string): Promise<EventResponse> {
  return get<EventResponse>(`/admin/events/${id}`)
}

export function createEvent(req: EventRequest): Promise<EventResponse> {
  return post<EventResponse>('/admin/events', req)
}

export function updateEvent(id: string, req: EventRequest): Promise<EventResponse> {
  return patch<EventResponse>(`/admin/events/${id}`, req)
}

export function deactivateEvent(id: string): Promise<void> {
  return del<void>(`/admin/events/${id}`)
}

export function rolloutEventMissions(id: string): Promise<void> {
  return post<void>(`/admin/events/${id}/rollout`)
}

export function getAdminEventMissions(id: string): Promise<MissionTemplateResponse[]> {
  return get<MissionTemplateResponse[]>(`/admin/events/${id}/missions`)
}

function multipartFile(file: File): FormData {
  const form = new FormData()
  form.append('file', file)
  return form
}

export function uploadEventBackground(id: string, file: File): Promise<EventResponse> {
  return postMultipart<EventResponse>(`/admin/events/${id}/background`, multipartFile(file))
}

export function deleteEventBackground(id: string): Promise<EventResponse> {
  return del<EventResponse>(`/admin/events/${id}/background`)
}

export function uploadEventIcon(id: string, file: File): Promise<EventResponse> {
  return postMultipart<EventResponse>(`/admin/events/${id}/icon`, multipartFile(file))
}

export function deleteEventIcon(id: string): Promise<EventResponse> {
  return del<EventResponse>(`/admin/events/${id}/icon`)
}
