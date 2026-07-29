import type { UserResponse } from '@/types/api/users'
import { get, post } from '../client'
import { buildQuery } from '../utils'

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
