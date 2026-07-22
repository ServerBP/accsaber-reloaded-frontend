import type {
  MarkAllReadResponse,
  NotificationListParams,
  NotificationResponse,
  UnreadCountResponse,
} from '@/types/api/notifications'
import type { Page } from '@/types/pagination'
import { del, get, patch } from './client'
import { buildQuery } from './utils'

export function getNotifications(
  params?: NotificationListParams,
): Promise<Page<NotificationResponse>> {
  return get<Page<NotificationResponse>>(`/notifications${buildQuery(params)}`)
}

export function getUnreadNotificationCount(): Promise<UnreadCountResponse> {
  return get<UnreadCountResponse>('/notifications/unread-count')
}

export function markNotificationRead(id: string): Promise<void> {
  return patch<void>(`/notifications/${id}/read`)
}

export function markAllNotificationsRead(): Promise<MarkAllReadResponse> {
  return patch<MarkAllReadResponse>('/notifications/read')
}

export function clearAllNotifications(): Promise<void> {
  return del<void>('/notifications')
}
