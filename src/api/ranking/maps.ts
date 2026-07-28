import type {
  ApproveReweightRequest,
  ApproveUnrankRequest,
  BulkReweightRequest,
  BulkUnrankRequest,
  ImportMapFromLeaderboardIdsRequest,
  UpdateMapComplexityRequest,
  UpdateMapStatusRequest,
} from '@/types/api/admin'
import type {
  AutoCriteriaCheckResponse,
  DifficultyListParams,
  MapDifficultyResponse,
  MapListParams,
  MapResponse,
  RefreshDifficultyRequest,
} from '@/types/api/maps'
import type { Page } from '@/types/pagination'
import type { Difficulty } from '@/types/enums'
import { get, patch, post } from '../client'
import { buildQuery } from '../utils'

export interface AiComplexityResponse {
  complexity: number | null
}

export function getAiComplexity(params: {
  songHash: string
  difficulty: Difficulty
  characteristic: string
}): Promise<AiComplexityResponse> {
  return get<AiComplexityResponse>(
    `/ranking/maps/difficulties/ai-complexity${buildQuery(params)}`,
  )
}

export function getRankingMaps(params?: MapListParams): Promise<Page<MapResponse>> {
  return get<Page<MapResponse>>(`/ranking/maps${buildQuery(params)}`)
}

export function getRankingMap(mapId: string): Promise<MapResponse> {
  return get<MapResponse>(`/ranking/maps/${mapId}`)
}

export function getRankingMapByHash(songHash: string): Promise<MapResponse> {
  return get<MapResponse>(`/ranking/maps/hash/${songHash}`)
}

export function getRankingMapByCode(beatsaverCode: string): Promise<MapResponse> {
  return get<MapResponse>(`/ranking/maps/by-code/${beatsaverCode}`)
}

export function getRankingMapDifficulties(mapId: string): Promise<MapDifficultyResponse[]> {
  return get<MapDifficultyResponse[]>(`/ranking/maps/${mapId}/difficulties`)
}

export function getRankingDifficulty(difficultyId: string): Promise<MapDifficultyResponse> {
  return get<MapDifficultyResponse>(`/ranking/maps/difficulties/${difficultyId}`)
}

export function getRankingDifficulties(
  params?: DifficultyListParams,
): Promise<Page<MapDifficultyResponse>> {
  return get<Page<MapDifficultyResponse>>(`/ranking/maps/difficulties${buildQuery(params)}`)
}

export function getDeactivatedDifficulties(
  params?: DifficultyListParams,
): Promise<Page<MapDifficultyResponse>> {
  const query = buildQuery({ sort: 'updatedAt,desc', ...params, active: false })
  return get<Page<MapDifficultyResponse>>(`/ranking/maps/difficulties${query}`)
}

export function importMap(req: ImportMapFromLeaderboardIdsRequest): Promise<MapDifficultyResponse> {
  return post<MapDifficultyResponse>('/ranking/maps/import', req)
}

export function updateMapStatus(
  difficultyId: string,
  req: UpdateMapStatusRequest,
): Promise<MapDifficultyResponse> {
  return patch<MapDifficultyResponse>(`/ranking/maps/difficulties/${difficultyId}/status`, req)
}

export function updateMapComplexity(
  difficultyId: string,
  req: UpdateMapComplexityRequest,
): Promise<MapDifficultyResponse> {
  return post<MapDifficultyResponse>(`/ranking/maps/difficulties/${difficultyId}/complexity`, req)
}

export function refreshDifficulty(
  difficultyId: string,
  req: RefreshDifficultyRequest,
): Promise<MapDifficultyResponse> {
  return post<MapDifficultyResponse>(`/ranking/maps/difficulties/${difficultyId}/refresh`, req)
}

export function runAutoCriteriaCheck(
  difficultyId: string,
): Promise<AutoCriteriaCheckResponse> {
  return post<AutoCriteriaCheckResponse>(
    `/ranking/maps/difficulties/${difficultyId}/auto-criteria-check`,
  )
}

export function updateMapCategory(
  difficultyId: string,
  req: { categoryId: string },
): Promise<MapDifficultyResponse> {
  return patch<MapDifficultyResponse>(`/ranking/maps/difficulties/${difficultyId}/category`, req)
}

export function deactivateMapDifficulty(difficultyId: string): Promise<void> {
  return patch<void>(`/ranking/maps/difficulties/${difficultyId}/deactivate`)
}

export function approveReweight(
  difficultyId: string,
  req: ApproveReweightRequest,
): Promise<MapDifficultyResponse> {
  return post<MapDifficultyResponse>(`/ranking/maps/difficulties/${difficultyId}/reweight`, req)
}

export function bulkReweight(req: BulkReweightRequest): Promise<void> {
  return post<void>('/ranking/maps/difficulties/bulk-reweight', req)
}

export function approveUnrank(req: ApproveUnrankRequest): Promise<void> {
  return post<void>('/ranking/maps/difficulties/unrank', req)
}

export function bulkUnrank(req: BulkUnrankRequest): Promise<void> {
  return post<void>('/ranking/maps/difficulties/unrank/bulk', req)
}
