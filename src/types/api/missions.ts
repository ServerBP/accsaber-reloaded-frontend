import type { CategoryCode } from '@/types/display'
import type { ItemResponse } from './items'

export type MissionType =
  | 'PLAY_N_MAPS'
  | 'XP_IN_WINDOW'
  | 'ACC_ON_MAP'
  | 'AP_ON_MAP'
  | 'PB_SPECIFIC_MAP'
  | 'PB_ABOVE_THRESHOLD'
  | 'SNIPE_PLAYER_ON_MAP'
  | 'STREAK_ON_MAP'
  | 'STREAK_N_IN_CATEGORY'
  | 'COMEBACK_PB'
  | 'SCORES_N'

export type MissionPool = 'daily' | 'weekly' | 'event'

export type MissionStatus = 'active' | 'completed' | 'expired' | 'voided'

export type MissionBand = 'easy' | 'medium' | 'hard' | 'extreme'

export interface MissionResponse {
  id: string
  name: string
  description: string
  type: MissionType
  pool: MissionPool

  categoryId?: string
  categoryCode?: CategoryCode

  targetMapDifficultyId?: string
  targetMapSongName?: string

  targetPlayerId?: string
  targetPlayerName?: string

  targetAcc?: number
  targetAp?: number
  targetScore?: number
  targetCount?: number
  targetXp?: number
  targetThresholdAp?: number
  targetStreak?: number

  xpReward?: number
  itemReward?: ItemResponse

  status?: MissionStatus
  band?: MissionBand
  progressCount?: number
  assignedAt?: string
  expiresAt?: string
  completedAt?: string

  code?: string
  week?: number
  unlocksAt?: string
  completableUntil?: string
  unlocked?: boolean
  open?: boolean
  repeatable?: boolean
  maxCompletions?: number
}

export interface MissionListParams {
  pool?: MissionPool
}
