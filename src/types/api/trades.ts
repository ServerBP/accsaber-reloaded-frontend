import type { PaginationParams } from '../pagination'
import type { ItemModifierRef, ItemResponse, UnusualEffectRef } from './items'

export type TradeStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired'

export type TradeDirection = 'incoming' | 'outgoing' | 'both'

export const TRADE_MAX_ITEMS_PER_SIDE = 8

export interface TradeItemRef {
  linkId: string
  item: ItemResponse
  modifiers: ItemModifierRef[]
  unusualEffect: UnusualEffectRef | null
  serialNumber: number | null
  quantity: number
}

export interface TradeResponse {
  id: string
  fromUserId: string
  toUserId: string
  offeredItems: TradeItemRef[]
  requestedItems: TradeItemRef[]
  offeredEssence: number
  requestedEssence: number
  status: TradeStatus
  message: string | null
  createdAt: string
  resolvedAt: string | null
}

export interface TradeListParams extends PaginationParams {
  direction?: TradeDirection
  status?: TradeStatus[]
}

export interface TradeItemInput {
  userItemLinkId: string
  quantity: number
}

export interface CreateTradeRequest {
  toUserId: string
  offeredItems: TradeItemInput[]
  requestedItems: TradeItemInput[]
  offeredEssence?: number
  requestedEssence?: number
  message?: string
}
