import type { Difficulty, MapDifficultyStatus, MapVoteAction, VoteType } from '../enums'
import type { PaginationParams } from '../pagination'
import type { UserRelationType } from './relations'

export type CriteriaStatus = 'PENDING' | 'PASSED' | 'FAILED'

export type AutoCriteriaStatus = 'PENDING' | 'PASSED' | 'FAILED' | 'UNAVAILABLE'

export interface AutoCriteriaCheckResponse {
  status: Exclude<AutoCriteriaStatus, 'PENDING'>
  failures: string[]
}

export interface MapResponse {
  id: string
  songName: string
  songAuthor: string
  songHash: string
  mapAuthor: string
  beatsaverCode: string
  coverUrl: string
  cdnCoverUrl?: string | null
  difficulties: MapDifficultyResponse[]
  createdAt: string
}

export interface PublicMapResponse {
  id: string
  songName: string
  songAuthor: string
  songHash: string
  mapAuthor: string
  beatsaverCode: string
  coverUrl: string
  cdnCoverUrl?: string | null
  difficulties: PublicMapDifficultyResponse[]
  createdAt: string
}

export interface MapDifficultyResponse {
  id: string
  mapId: string
  songName: string
  songSubName: string | null
  songAuthor: string
  beatsaverCode: string | null
  mapAuthor: string
  coverUrl: string
  cdnCoverUrl?: string | null
  categoryId: string
  previousVersionId: string | null
  difficulty: Difficulty
  characteristic: string
  active: boolean
  status: MapDifficultyStatus
  criteriaStatus: string
  autoCriteriaStatus: AutoCriteriaStatus
  ssLeaderboardId: string | null
  blLeaderboardId: string | null
  maxScore: number
  complexity: number
  averageVoteComplexity: number | null
  rankedAt: string | null
  createdAt: string
  createdBy: string | null
  createdByUsername: string | null
  createdByAvatarUrl: string | null
  createdByCdnAvatarUrl?: string | null
  lastUpdatedBy: string | null
  lastUpdatedByUsername: string | null
  rankUpvotes: number
  rankDownvotes: number
  reweightUpvotes: number
  reweightDownvotes: number
  unrankUpvotes: number
  unrankDownvotes: number
  criteriaUpvotes: number
  criteriaDownvotes: number
  headCriteriaVote: VoteType | null
  statistics: MapDifficultyStatisticsResponse | null
}

export interface PublicMapDifficultyResponse {
  id: string
  mapId: string
  songName: string
  songSubName: string | null
  songAuthor: string
  beatsaverCode: string | null
  mapAuthor: string
  coverUrl: string
  cdnCoverUrl?: string | null
  categoryId: string
  difficulty: Difficulty
  characteristic: string
  status: MapDifficultyStatus
  criteriaStatus: CriteriaStatus | null
  autoCriteriaStatus: AutoCriteriaStatus | null
  ssLeaderboardId: string | null
  blLeaderboardId: string | null
  maxScore: number
  complexity: number | null
  rankedAt: string | null
  createdAt: string
  rankUpvotes: number | null
  rankDownvotes: number | null
  statistics: MapDifficultyStatisticsResponse | null
}

export interface TopScoreSnapshot {
  scoreId: string
  userId: string
  userName: string
  avatarUrl: string
  cdnAvatarUrl?: string | null
  score: number
  accuracy: number
  ap: number
  timeSet: string
}

export interface MapDifficultyStatisticsResponse {
  id: string
  maxAp: number
  minAp: number
  averageAp: number
  totalScores: number
  topScore: TopScoreSnapshot | null
  createdAt: string
}

export interface MapComplexityHistoryResponse {
  id: string
  mapDifficultyId: string
  complexity: number
  createdAt: string
}

export interface VoteResponse {
  id: string
  mapDifficultyId: string
  staffId: string
  staffUsername: string | null
  staffAvatarUrl: string | null
  staffCdnAvatarUrl?: string | null
  vote: VoteType
  type: MapVoteAction
  suggestedComplexity: number | null
  criteriaVote: VoteType | null
  criteriaVoteOverride: boolean
  reason: string | null
  active: boolean
  createdAt: string
  updatedAt: string
  songName: string | null
  songAuthor: string | null
  mapAuthor: string | null
  coverUrl: string | null
  cdnCoverUrl?: string | null
  difficulty: Difficulty | null
  complexity: number | null
  categoryId: string | null
}

export interface VoteListResponse {
  votes: VoteResponse[]
  rankReady: boolean
  reweightReady: boolean
  unrankReady: boolean
  criteriaUpvotes: number
  criteriaDownvotes: number
  headCriteriaVote: VoteType | null
}

export interface MapListParams extends PaginationParams {
  categoryId?: string
  status?: MapDifficultyStatus
  search?: string
}

export interface DifficultyListParams extends PaginationParams {
  categoryId?: string
  status?: MapDifficultyStatus
  complexityMin?: number
  complexityMax?: number
  search?: string
  batchId?: string
}

export interface DifficultyScoreParams extends PaginationParams {
  country?: string
  relation?: UserRelationType
}

export interface RefreshDifficultyRequest {
  blLeaderboardId: string
  ssLeaderboardId: string
}

