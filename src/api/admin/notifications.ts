import type {
  BroadcastNotificationRequest,
  BroadcastNotificationResponse,
  TestNotificationRequest,
  TestNotificationResponse,
} from '@/types/api/notifications'
import { post } from '../client'

export function broadcastNotification(
  req: BroadcastNotificationRequest,
): Promise<BroadcastNotificationResponse> {
  return post<BroadcastNotificationResponse>('/admin/notifications/broadcast', req)
}

export function sendTestNotification(
  req: TestNotificationRequest,
): Promise<TestNotificationResponse> {
  return post<TestNotificationResponse>('/admin/notifications/test', req)
}
