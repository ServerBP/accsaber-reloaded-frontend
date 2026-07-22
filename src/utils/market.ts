import type {
  MarketListingResponse,
  MarketListingStatus,
  MarketUserRef,
} from '@/types/api/market'
import { digitsOnly } from '@/utils/formatters'

export type MarketListingKind = 'shop' | 'auction' | 'auction_buyout'

export function listingKind(listing: MarketListingResponse): MarketListingKind {
  if (listing.startingBid == null) return 'shop'
  return listing.buyoutPrice == null ? 'auction' : 'auction_buyout'
}

export function isAuction(listing: MarketListingResponse): boolean {
  return listing.startingBid != null
}

export interface ListingPrice {
  label: string
  amount: number | null
}

export function listingPrice(listing: MarketListingResponse): ListingPrice {
  if (listing.status === 'sold') return { label: 'Sold for', amount: listing.finalPrice }
  if (listing.status === 'expired') return { label: 'Expired', amount: null }
  if (listing.status === 'cancelled') return { label: 'Cancelled', amount: null }
  if (listing.startingBid == null) return { label: 'Buy now', amount: listing.buyoutPrice }
  if (listing.currentBid != null) return { label: 'Current bid', amount: listing.currentBid }
  return { label: 'Starting bid', amount: listing.startingBid }
}

export function isSameMarketUser(
  ref: MarketUserRef | null | undefined,
  userId: string | null | undefined,
): boolean {
  if (!ref || userId == null) return false
  return String(ref.id) === String(userId)
}

export function sanitizeEssenceInput(raw: string | number): number | null {
  const digits = digitsOnly(raw)
  if (!digits) return null
  const value = Number(digits)
  return Number.isSafeInteger(value) && value >= 1 ? value : null
}

export const MARKET_STATUS_LABEL: Record<MarketListingStatus, string> = {
  active: 'Active',
  sold: 'Sold',
  expired: 'Expired',
  cancelled: 'Cancelled',
}

export interface ListingDurationPreset {
  label: string
  minutes: number
}

export const LISTING_DURATION_PRESETS: ListingDurationPreset[] = [
  { label: '1 hour', minutes: 60 },
  { label: '6 hours', minutes: 360 },
  { label: '24 hours', minutes: 1440 },
  { label: '3 days', minutes: 4320 },
  { label: '7 days', minutes: 10080 },
]

export const MAX_ACTIVE_LISTINGS = 20

export function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return 'Ended'
  const totalSeconds = Math.floor(msRemaining / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}
