import type { PaginationParams } from '../pagination'
import type { ItemRarity, UserItemResponse } from './items'

export type MarketListingStatus = 'active' | 'sold' | 'expired' | 'cancelled'

export type MarketKind = 'auction' | 'shop'

export type MarketSortOption = 'ending_soon' | 'newest' | 'price_asc' | 'price_desc'

export type MarketEventType = 'bid' | 'extended' | 'sold' | 'expired' | 'cancelled'

export interface MarketUserRef {
  id: string
  name: string
  avatarUrl: string | null
  cdnAvatarUrl: string | null
  country: string | null
}

export interface MarketListingResponse {
  id: string
  title: string
  description: string | null
  seller: MarketUserRef
  item: UserItemResponse
  quantity: number
  startingBid: number | null
  buyoutPrice: number | null
  minIncrement: number
  currentBid: number | null
  currentBidder: MarketUserRef | null
  minimumNextBid: number | null
  bidCount: number
  status: MarketListingStatus
  createdAt: string
  endsAt: string | null
  settledAt: string | null
  winner: MarketUserRef | null
  finalPrice: number | null
}

export interface MarketBidResponse {
  id: string
  listingId: string
  bidder: MarketUserRef
  amount: number
  buyout: boolean
  createdAt: string
}

export interface MarketListingEvent {
  listingId: string
  type: MarketEventType
  status: MarketListingStatus
  amount: number | null
  actor: MarketUserRef | null
  endsAt: string | null
}

export interface MarketBrowseParams {
  search?: string
  rarity?: ItemRarity[]
  typeKey?: string[]
  modifierKey?: string[]
  effectKey?: string[]
  kind?: MarketKind
  minPrice?: number
  maxPrice?: number
  status?: MarketListingStatus
  sellerId?: string
  sortBy?: MarketSortOption
  page?: number
  size?: number
}

export interface MyMarketListingsParams extends PaginationParams {
  status?: MarketListingStatus[]
}

export interface CreateMarketListingRequest {
  userItemLinkId: string
  quantity: number
  title: string
  description: string | null
  startingBid: number | null
  buyoutPrice: number | null
  minIncrement: number
  durationMinutes: number | null
}
