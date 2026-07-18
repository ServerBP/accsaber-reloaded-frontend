import type { MilestoneTier, MilestoneType, SupersedesReason } from '../enums'
import type { PaginationParams } from '../pagination'
import type { UserRelationCounts } from './relations'
import type { SupporterTier } from './supporters'

export interface UserResponse {
  id: string
  blId?: string
  ssId?: string
  name: string
  avatarUrl: string
  cdnAvatarUrl?: string | null
  country: string
  bio: string
  xpRanking: number
  xpCountryRanking: number
  playerInactive: boolean
  banned: boolean
  createdAt: string
  relations: UserRelationCounts
  supporterTier?: SupporterTier | null
}

export interface PinnedScoreInput {
  scoreId: string
  displayOrder: number
  comment?: string | null
}

export interface ProfileUpdateRequest {
  name?: string
  bio?: string
  pinnedScores?: PinnedScoreInput[]
}

export interface PinnedScoreResponse {
  score: ScoreResponse
  comment: string | null
}

export interface NameHistoryEntry {
  name: string
  changedAt: string
}

export interface SyncSettings {
  'sync.name': boolean
  'sync.avatar'?: boolean
}

export interface ScoreResponse {
  id: string
  userId: string
  userName: string
  avatarUrl: string
  cdnAvatarUrl?: string | null
  country: string
  mapDifficultyId: string
  mapId: string
  beatsaverCode: string | null
  characteristic: string
  songName: string
  songAuthor: string
  mapAuthor: string
  coverUrl: string
  cdnCoverUrl?: string | null
  difficulty: string
  categoryId: string
  score: number
  scoreNoMods: number
  accuracy: number
  rank: number
  countryRank: number
  rankWhenSet: number
  ap: number
  weightedAp: number
  complexity: number | null
  blScoreId: number | null
  ssScoreId: number | null
  maxCombo: number
  badCuts: number
  misses: number
  wallHits: number
  bombHits: number
  pauses: number
  streak115: number
  playCount: number
  hmd: string
  timeSet: string
  reweightDerivative: boolean
  xpGained: number
  baseXp: number
  bonusXp: number
  modifierIds: string[]
  active: boolean
  partial: boolean
  supersedesReason: SupersedesReason | null
  createdAt: string
  supporterTier?: SupporterTier | null
  myScore?: MyScoreSummary
}

export interface MyScoreSummary {
  id: string
  score: number
  accuracy: number
  ap: number
  weightedAp: number
  rank: number
  timeSet: string
}

export interface LeaderboardResponse {
  ranking: number
  countryRanking: number
  rankingLastWeek: number | null
  userId: string
  userName: string
  country: string
  avatarUrl: string
  cdnAvatarUrl?: string | null
  ap: number
  averageAcc: number
  averageAp: number
  rankedPlays: number
  topPlayId: string
  playerInactive: boolean
  supporterTier?: SupporterTier | null
}

export interface XpLeaderboardResponse {
  ranking: number
  countryRanking: number
  rankingLastWeek: number | null
  userId: string
  userName: string
  country: string
  avatarUrl: string
  cdnAvatarUrl?: string | null
  totalXp: number
  level: number
  playerInactive: boolean
  supporterTier?: SupporterTier | null
}

export interface UserAllStatisticsResponse {
  totalXp: number
  totalScoreXp: number
  totalMilestoneXp: number
  totalMilestoneSetBonusXp: number
  totalMissionXp: number
  totalCampaignXp: number
  categories: UserCategoryStatisticsResponse[]
}

export interface UserCategoryStatisticsResponse {
  id: string
  userId: string
  categoryId: string
  ranking: number
  countryRanking: number
  ap: number
  averageAcc: number
  averageAp: number
  rankedPlays: number
  scoreXp: number
  topPlayId: string
  createdAt: string
}

export interface LevelResponse {
  level: number
  title: string
  totalXp: number
  xpForCurrentLevel: number
  xpForNextLevel: number
  progressPercent: number
}

export interface UserMilestoneProgressResponse {
  milestoneId: string
  title: string
  description: string
  type: MilestoneType
  tier: MilestoneTier
  xp: number
  targetValue: number
  progress: number
  normalizedProgress: number | null
  completed: boolean
  completedAt: string | null
  completionPercentage: number
  setId: string
  categoryId: string | null
}

export interface StatsDiffResponse {
  categoryId: string
  apDiff: number
  scoreXpDiff: number
  milestoneXpDiff: number
  milestoneSetBonusXpDiff: number
  missionXpDiff: number
  campaignXpDiff: number
  averageAccDiff: number
  averageApDiff: number
  rankingDiff: number
  countryRankingDiff: number
  rankedPlaysDiff: number
  from: string
  to: string
}

export interface UserScoresParams extends PaginationParams {
  categoryId?: string
  search?: string
}

export interface HistoricStatisticsParams {
  category: string
  amount: number
  unit: 'h' | 'd' | 'mo'
}

export interface RankingHistoryResponse {
  ranking: number
  countryRanking: number
  recordedAt: string
}

export interface HistoricScoresParams {
  mapDifficultyId: string
  amount?: number
  unit?: 'h' | 'd' | 'w' | 'mo'
}

export interface SkillComponents {
  rank: number
  sustained: number
  peak: number
  combined: number
  rawApForOneGain: number
  topAp: number
  categoryRank: number | null
  activePlayers: number
}

export interface SkillCategory {
  categoryCode: string
  categoryName: string
  skillLevel: number
  components: SkillComponents
}

export interface SkillResponse {
  userId: string
  skills: SkillCategory[]
}

export interface ApToNextResponse {
  userId: string
  categoryCode: string
  rawApForOneGain: number
}
