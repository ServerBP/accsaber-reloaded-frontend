import type {
  CreateMarketListingRequest,
  MarketBidResponse,
  MarketBrowseParams,
  MarketListingResponse,
  MyMarketListingsParams,
} from '@/types/api/market'
import type { Page, PaginationParams } from '@/types/pagination'
import { del, get, post } from './client'
import { buildQuery } from './utils'

export function getMarketListings(params?: MarketBrowseParams): Promise<Page<MarketListingResponse>> {
  return get<Page<MarketListingResponse>>(`/market/listings${buildQuery(params)}`)
}

export function getMarketListing(id: string): Promise<MarketListingResponse> {
  return get<MarketListingResponse>(`/market/listings/${id}`)
}

export function getMarketListingBids(id: string): Promise<MarketBidResponse[]> {
  return get<MarketBidResponse[]>(`/market/listings/${id}/bids`)
}

export function createMarketListing(req: CreateMarketListingRequest): Promise<MarketListingResponse> {
  return post<MarketListingResponse>('/market/listings', req)
}

export function cancelMarketListing(id: string): Promise<MarketListingResponse> {
  return del<MarketListingResponse>(`/market/listings/${id}`)
}

export function placeMarketBid(id: string, amount: number): Promise<MarketListingResponse> {
  return post<MarketListingResponse>(`/market/listings/${id}/bids`, { amount })
}

export function buyMarketListing(id: string): Promise<MarketListingResponse> {
  return post<MarketListingResponse>(`/market/listings/${id}/buy`)
}

export function getMyMarketListings(params?: MyMarketListingsParams): Promise<Page<MarketListingResponse>> {
  return get<Page<MarketListingResponse>>(`/market/me/listings${buildQuery(params)}`)
}

export function getMyMarketBids(params?: PaginationParams): Promise<Page<MarketBidResponse>> {
  return get<Page<MarketBidResponse>>(`/market/me/bids${buildQuery(params)}`)
}
