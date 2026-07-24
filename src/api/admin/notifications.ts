import type {
  BroadcastNotificationRequest,
  BroadcastNotificationResponse,
} from '@/types/api/notifications'
import { post } from '../client'

export function broadcastNotification(
  req: BroadcastNotificationRequest,
): Promise<BroadcastNotificationResponse> {
  return post<BroadcastNotificationResponse>('/admin/notifications/broadcast', req)
}
