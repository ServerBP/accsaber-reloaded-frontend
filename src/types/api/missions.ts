import type { CategoryCode } from '@/types/display'

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

export interface UserMissionResponse {
  id: string
  name: string
  description: string
  type: MissionType
  pool: MissionPool
  status: MissionStatus
  band: MissionBand

  categoryId: string | null
  categoryCode: CategoryCode | null

  targetMapDifficultyId: string | null
  targetMapSongName: string | null

  targetPlayerId: string | null
  targetPlayerName: string | null

  targetAcc: number | null
  targetAp: number | null
  targetScore: number | null
  targetCount: number | null
  targetXp: number | null
  targetThresholdAp: number | null

  progressCount: number

  xpReward: number
  crateRewardId: string | null
  crateRewardName: string | null

  assignedAt: string
  expiresAt: string
  completedAt: string | null
}

export interface MissionListParams {
  pool?: MissionPool
}
