import type { NotificationType } from '@/types/api/notifications'

export const NOTIFICATION_TYPES: readonly NotificationType[] = [
  'trade_offer',
  'trade_accepted',
  'trade_declined',
  'market_sold',
  'market_bid',
  'market_outbid',
  'item_earned',
  'server',
]

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  trade_offer: 'Trade offer',
  trade_accepted: 'Trade accepted',
  trade_declined: 'Trade declined',
  market_sold: 'Market sold',
  market_bid: 'Market bid',
  market_outbid: 'Market outbid',
  item_earned: 'Item earned',
  server: 'Server announcement',
}
