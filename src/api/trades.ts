import type { CreateTradeRequest, TradeListParams, TradeResponse } from '@/types/api/trades'
import type { Page } from '@/types/pagination'
import { get, post } from './client'
import { buildQuery } from './utils'

export function createTrade(req: CreateTradeRequest): Promise<TradeResponse> {
  return post<TradeResponse>('/trades', req)
}

export function acceptTrade(id: string): Promise<TradeResponse> {
  return post<TradeResponse>(`/trades/${id}/accept`)
}

export function declineTrade(id: string): Promise<TradeResponse> {
  return post<TradeResponse>(`/trades/${id}/decline`)
}

export function cancelTrade(id: string): Promise<TradeResponse> {
  return post<TradeResponse>(`/trades/${id}/cancel`)
}

export function getTrades(params?: TradeListParams): Promise<Page<TradeResponse>> {
  return get<Page<TradeResponse>>(`/trades${buildQuery(params)}`)
}
