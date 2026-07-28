import type { JobResponse, LeaderboardPlatform } from '@/types/api/jobs'
import type { UserResponse } from '@/types/api/users'
import { get, post } from '../client'
import { buildQuery } from '../utils'
import { runJob } from './jobs'

// --- AP recalculation (background jobs) ---

export function recalculateApByDifficulty(difficultyId: string): Promise<JobResponse> {
  return runJob({ type: 'RECALCULATE_AP_DIFFICULTY', difficultyId })
}

export function recalculateApByDifficulties(difficultyIds: string[]): Promise<JobResponse> {
  return runJob({ type: 'RECALCULATE_AP_DIFFICULTIES', difficultyIds })
}

export function recalculateRawAp(): Promise<JobResponse> {
  return runJob({ type: 'RECALCULATE_AP_RAW' })
}

export function recalculateWeightedAp(): Promise<JobResponse> {
  return runJob({ type: 'RECALCULATE_AP_WEIGHTED' })
}

export function recalculateAllAp(): Promise<JobResponse> {
  return runJob({ type: 'RECALCULATE_AP_ALL' })
}

// --- XP recalculation (background jobs) ---

export function recalculateScoreXp(): Promise<JobResponse> {
  return runJob({ type: 'RECALCULATE_XP_SCORES' })
}

export function recalculateXpSums(): Promise<JobResponse> {
  return runJob({ type: 'RECALCULATE_XP_TOTALS' })
}

// --- Score backfill (background jobs) ---

export function backfillAllScores(): Promise<JobResponse> {
  return runJob({ type: 'BACKFILL_SCORES_ALL' })
}

export function backfillScoresByDifficulty(difficultyId: string): Promise<JobResponse> {
  return runJob({ type: 'BACKFILL_SCORES_DIFFICULTY', difficultyId })
}

export function backfillScoresByDifficulties(difficultyIds: string[]): Promise<JobResponse> {
  return runJob({ type: 'BACKFILL_SCORES_DIFFICULTIES', difficultyIds })
}

export function backfillScoresByUser(userId: string): Promise<JobResponse> {
  return runJob({ type: 'BACKFILL_SCORES_USER', userId })
}

export function backfillScoresByUsers(userIds: string[]): Promise<JobResponse> {
  return runJob({ type: 'BACKFILL_SCORES_USERS', userIds })
}

export function gapFillScores(since: string, platform?: LeaderboardPlatform): Promise<JobResponse> {
  return runJob({ type: 'BACKFILL_SCORES_GAP_FILL', since, platform })
}

// --- CDN backfill (background jobs) ---

export function backfillCdnMapCovers(force = false): Promise<JobResponse> {
  return runJob({ type: 'BACKFILL_CDN_MAP_COVERS', force })
}

export function backfillCdnAvatars(force = false): Promise<JobResponse> {
  return runJob({ type: 'BACKFILL_CDN_AVATARS', force })
}

// --- Song suggest (background job) ---

export function regenerateSongSuggest(): Promise<JobResponse> {
  return runJob({ type: 'REGENERATE_SONG_SUGGEST' })
}

// --- Stats recalculation (synchronous) ---

export function recalculatePlayerStats(userId: string, categoryId: string): Promise<void> {
  return post<void>(`/admin/recalculate/stats/player/${userId}${buildQuery({ categoryId })}`)
}

// --- Score removal (synchronous) ---

export interface RemoveScoreParams {
  userId: string
  mapDifficultyId: string
  reason?: string
}

export function removeScore(params: RemoveScoreParams): Promise<void> {
  return post<void>(`/admin/recalculate/scores/remove${buildQuery(params)}`)
}

// --- CDN maintenance (synchronous) ---

export function repairCdnPermissions(): Promise<number> {
  return post<number>('/admin/cdn/repair-permissions')
}

// --- Player refresh ---

export function refreshPlayer(userId: string): Promise<UserResponse> {
  return post<UserResponse>(`/admin/users/${userId}/refresh`)
}

export function refreshAllPlayers(): Promise<void> {
  return post<void>('/admin/users/refresh')
}

// --- WebSocket management ---

export interface WsStatus {
  [platform: string]: Record<string, unknown>
}

export function getWsStatus(): Promise<WsStatus> {
  return get<WsStatus>('/admin/ws/status')
}

export function reconnectWs(platform: 'beatleader' | 'scoresaber'): Promise<void> {
  return post<void>(`/admin/ws/reconnect${buildQuery({ platform })}`)
}
