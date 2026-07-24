import type { PaginationParams } from '@/types/pagination'

export type NotificationType =
  | 'trade_offer'
  | 'trade_accepted'
  | 'trade_declined'
  | 'market_sold'
  | 'market_bid'
  | 'market_outbid'
  | 'item_earned'
  | 'server'

export interface NotificationResponse {
  id: string
  type: NotificationType | (string & {})
  title: string
  linkTo: string | null
  read: boolean
  createdAt: string
}

export interface NotificationListParams extends PaginationParams {
  unreadOnly?: boolean
}

export interface UnreadCountResponse {
  count: number
}

export interface MarkAllReadResponse {
  updated: number
}

export interface BroadcastNotificationRequest {
  title: string
  linkTo: string | null
}

export interface BroadcastNotificationResponse {
  delivered: number
}
