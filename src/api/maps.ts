import type {
  DifficultyListParams,
  DifficultyScoreParams,
  MapComplexityHistoryResponse,
  MapDifficultyStatisticsResponse,
  MapListParams,
  PublicMapDifficultyResponse,
  PublicMapResponse,
} from '@/types/api/maps'
import type { ScoreResponse } from '@/types/api/users'
import type { Page } from '@/types/pagination'
import { get } from './client'
import { buildQuery } from './utils'

export function getMaps(params?: MapListParams): Promise<Page<PublicMapResponse>> {
  return get<Page<PublicMapResponse>>(`/maps${buildQuery(params)}`)
}

export function getMap(mapId: string): Promise<PublicMapResponse> {
  return get<PublicMapResponse>(`/maps/${mapId}`)
}

export function getMapByCode(
  code: string,
  params?: { difficulty?: string; characteristic?: string },
): Promise<PublicMapResponse> {
  return get<PublicMapResponse>(`/maps/by-code/${code}${buildQuery(params)}`)
}

export function getMapDifficulties(mapId: string): Promise<PublicMapDifficultyResponse[]> {
  return get<PublicMapDifficultyResponse[]>(`/maps/${mapId}/difficulties`)
}

export function getDifficulty(difficultyId: string): Promise<PublicMapDifficultyResponse> {
  return get<PublicMapDifficultyResponse>(`/maps/difficulties/${difficultyId}`)
}

const DIFFICULTY_BATCH_CHUNK = 100

export async function getDifficultiesByIds(
  ids: string[],
): Promise<PublicMapDifficultyResponse[]> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return []
  const chunks: string[][] = []
  for (let i = 0; i < unique.length; i += DIFFICULTY_BATCH_CHUNK) {
    chunks.push(unique.slice(i, i + DIFFICULTY_BATCH_CHUNK))
  }
  const results = await Promise.all(
    chunks.map((chunk) =>
      get<PublicMapDifficultyResponse[]>(`/maps/difficulties/batch${buildQuery({ ids: chunk })}`),
    ),
  )
  return results.flat()
}

export function getDifficulties(params?: DifficultyListParams): Promise<Page<PublicMapDifficultyResponse>> {
  return get<Page<PublicMapDifficultyResponse>>(`/maps/difficulties${buildQuery(params)}`)
}

export function getDifficultyScores(
  difficultyId: string,
  params?: DifficultyScoreParams,
): Promise<Page<ScoreResponse>> {
  return get<Page<ScoreResponse>>(`/maps/difficulties/${difficultyId}/scores${buildQuery(params)}`)
}

export function getDifficultyStatistics(difficultyId: string): Promise<MapDifficultyStatisticsResponse> {
  return get<MapDifficultyStatisticsResponse>(`/maps/difficulties/${difficultyId}/statistics`)
}

export function getDifficultyStatisticsHistoric(
  difficultyId: string,
  params: { amount: number; unit: string },
): Promise<MapDifficultyStatisticsResponse[]> {
  return get<MapDifficultyStatisticsResponse[]>(
    `/maps/difficulties/${difficultyId}/statistics/historic${buildQuery(params)}`,
  )
}

export function getComplexityHistory(mapId: string): Promise<MapComplexityHistoryResponse[]> {
  return get<MapComplexityHistoryResponse[]>(`/maps/${mapId}/complexity-history`)
}
