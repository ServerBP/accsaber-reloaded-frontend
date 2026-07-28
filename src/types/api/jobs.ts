export type JobType =
  | 'RECALCULATE_AP_DIFFICULTY'
  | 'RECALCULATE_AP_DIFFICULTIES'
  | 'RECALCULATE_AP_RAW'
  | 'RECALCULATE_AP_WEIGHTED'
  | 'RECALCULATE_AP_ALL'
  | 'RECALCULATE_XP_SCORES'
  | 'RECALCULATE_XP_TOTALS'
  | 'BACKFILL_SCORES_ALL'
  | 'BACKFILL_SCORES_DIFFICULTY'
  | 'BACKFILL_SCORES_DIFFICULTIES'
  | 'BACKFILL_SCORES_USER'
  | 'BACKFILL_SCORES_USERS'
  | 'BACKFILL_SCORES_GAP_FILL'
  | 'BACKFILL_CDN_MAP_COVERS'
  | 'BACKFILL_CDN_AVATARS'
  | 'BACKFILL_MILESTONE'
  | 'BACKFILL_MILESTONES_ALL'
  | 'BACKFILL_MILESTONES_USER'
  | 'REGENERATE_SONG_SUGGEST'

export type JobStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED'

export type LeaderboardPlatform = 'BEATLEADER' | 'SCORESABER'

export interface RunJobRequest {
  type: JobType
  difficultyId?: string
  difficultyIds?: string[]
  milestoneId?: string
  userId?: string
  userIds?: string[]
  since?: string
  platform?: LeaderboardPlatform
  force?: boolean
}

export interface JobResponse {
  id: string
  type: JobType
  detail: string | null
  status: JobStatus
  startedAt: string
  finishedAt: string | null
  error: string | null
}
