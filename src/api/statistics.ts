import type {
  DistributionEntryResponse,
  FirstEditionHolderResponse,
  ItemScarcityResponse,
  MapAvgApResponse,
  MapRetryResponse,
  MilestoneCollectorResponse,
  RarestUnboxedResponse,
  TimeSeriesPointResponse,
  UserCollectionResponse,
  UserCrateCountResponse,
  UserEssenceEarnedResponse,
  UserFirstEditionResponse,
  UserImprovementsResponse,
  UserInventoryValueResponse,
  UserItemCountResponse,
  UserMapImprovementsResponse,
  UserTraderResponse,
} from '@/types/api/statistics'
import type { ScoreResponse } from '@/types/api/users'
import type { Page, PaginationParams } from '@/types/pagination'
import { get } from './client'
import { buildQuery } from './utils'

export function getStreakLeaderboard(params?: PaginationParams, categoryId?: string, country?: string): Promise<Page<ScoreResponse>> {
  return get<Page<ScoreResponse>>(`/statistics/leaderboards/streaks${buildQuery({ ...params, categoryId, country })}`)
}

export function getMaxApLeaderboard(params?: PaginationParams, categoryId?: string, country?: string): Promise<Page<ScoreResponse>> {
  return get<Page<ScoreResponse>>(`/statistics/leaderboards/max-ap${buildQuery({ ...params, categoryId, country })}`)
}

export function getHighestAvgApMaps(params?: PaginationParams, categoryId?: string, minScores?: number, country?: string): Promise<Page<MapAvgApResponse>> {
  return get<Page<MapAvgApResponse>>(`/statistics/leaderboards/highest-avg-ap${buildQuery({ ...params, categoryId, minScores, country })}`)
}

export function getMostRetriedMaps(params?: PaginationParams, categoryId?: string, country?: string): Promise<Page<MapRetryResponse>> {
  return get<Page<MapRetryResponse>>(`/statistics/leaderboards/most-retried${buildQuery({ ...params, categoryId, country })}`)
}

export function getMostImprovements(params?: PaginationParams, categoryId?: string, country?: string): Promise<Page<UserImprovementsResponse>> {
  return get<Page<UserImprovementsResponse>>(`/statistics/leaderboards/most-improvements${buildQuery({ ...params, categoryId, country })}`)
}

export function getMostMapImprovements(params?: PaginationParams, categoryId?: string, country?: string): Promise<Page<UserMapImprovementsResponse>> {
  return get<Page<UserMapImprovementsResponse>>(`/statistics/leaderboards/most-map-improvements${buildQuery({ ...params, categoryId, country })}`)
}

export function getMilestoneCollectors(params?: PaginationParams, country?: string): Promise<Page<MilestoneCollectorResponse>> {
  return get<Page<MilestoneCollectorResponse>>(`/statistics/leaderboards/milestone-collectors${buildQuery({ ...params, country })}`)
}

export function getMostItems(params?: PaginationParams, type?: string, modifier?: string, country?: string): Promise<Page<UserItemCountResponse>> {
  return get<Page<UserItemCountResponse>>(`/statistics/leaderboards/most-items${buildQuery({ ...params, type, modifier, country })}`)
}

export function getMostCratesOpened(params?: PaginationParams, crateId?: string, country?: string): Promise<Page<UserCrateCountResponse>> {
  return get<Page<UserCrateCountResponse>>(`/statistics/leaderboards/most-crates-opened${buildQuery({ ...params, crateId, country })}`)
}

export function getMostValuableInventory(params?: PaginationParams, country?: string): Promise<Page<UserInventoryValueResponse>> {
  return get<Page<UserInventoryValueResponse>>(`/statistics/leaderboards/most-valuable-inventory${buildQuery({ ...params, country })}`)
}

export function getFirstEditions(params?: PaginationParams, country?: string): Promise<Page<UserFirstEditionResponse>> {
  return get<Page<UserFirstEditionResponse>>(`/statistics/leaderboards/first-editions${buildQuery({ ...params, country })}`)
}

export function getMostCompleteCollection(params?: PaginationParams, country?: string): Promise<Page<UserCollectionResponse>> {
  return get<Page<UserCollectionResponse>>(`/statistics/leaderboards/most-complete-collection${buildQuery({ ...params, country })}`)
}

export function getBiggestTraders(params?: PaginationParams, country?: string): Promise<Page<UserTraderResponse>> {
  return get<Page<UserTraderResponse>>(`/statistics/leaderboards/biggest-traders${buildQuery({ ...params, country })}`)
}

export function getMostEssenceEarned(params?: PaginationParams, country?: string): Promise<Page<UserEssenceEarnedResponse>> {
  return get<Page<UserEssenceEarnedResponse>>(`/statistics/leaderboards/most-essence-earned${buildQuery({ ...params, country })}`)
}

export function getRarestUnboxed(params?: PaginationParams, country?: string): Promise<Page<RarestUnboxedResponse>> {
  return get<Page<RarestUnboxedResponse>>(`/statistics/leaderboards/rarest-unboxed${buildQuery({ ...params, country })}`)
}

export function getFirstEditionHolders(params?: PaginationParams, country?: string): Promise<Page<FirstEditionHolderResponse>> {
  return get<Page<FirstEditionHolderResponse>>(`/statistics/leaderboards/first-edition-holders${buildQuery({ ...params, country })}`)
}

export function getRarestItems(params?: PaginationParams): Promise<Page<ItemScarcityResponse>> {
  return get<Page<ItemScarcityResponse>>(`/statistics/leaderboards/rarest-items${buildQuery({ ...params })}`)
}

export function getNewPlayersPerDay(params?: { amount?: number; unit?: string }): Promise<TimeSeriesPointResponse[]> {
  return get<TimeSeriesPointResponse[]>(`/statistics/charts/new-players-per-day${buildQuery(params)}`)
}

export function getScoresPerDay(params?: { amount?: number; unit?: string }): Promise<TimeSeriesPointResponse[]> {
  return get<TimeSeriesPointResponse[]>(`/statistics/charts/scores-per-day${buildQuery(params)}`)
}

export function getCumulativeAccounts(params?: { amount?: number; unit?: string }): Promise<TimeSeriesPointResponse[]> {
  return get<TimeSeriesPointResponse[]>(`/statistics/charts/cumulative-accounts${buildQuery(params)}`)
}

export function getCumulativeScores(params?: { amount?: number; unit?: string }): Promise<TimeSeriesPointResponse[]> {
  return get<TimeSeriesPointResponse[]>(`/statistics/charts/cumulative-scores${buildQuery(params)}`)
}

export function getScoresPerCategory(): Promise<DistributionEntryResponse[]> {
  return get<DistributionEntryResponse[]>('/statistics/charts/scores-per-category')
}

export function getPlayersByHmd(): Promise<DistributionEntryResponse[]> {
  return get<DistributionEntryResponse[]>('/statistics/charts/players-by-hmd')
}

export function getPlayersPerCountry(): Promise<DistributionEntryResponse[]> {
  return get<DistributionEntryResponse[]>('/statistics/charts/players-per-country')
}
