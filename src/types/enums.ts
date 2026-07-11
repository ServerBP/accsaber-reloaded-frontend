export type { MilestoneTier } from './display'

export type StaffRole =
  | 'RANKING'
  | 'RANKING_HEAD'
  | 'CAMPAIGN_CURATOR'
  | 'CREATIVE'
  | 'ADMIN'
  | 'DEVELOPER'
  | 'MODERATOR'

export type StaffUserStatus = 'REQUESTED' | 'ACCEPTED' | 'DENIED'

export type MapDifficultyStatus = 'QUEUE' | 'QUALIFIED' | 'RANKED'

export type BatchStatus = 'DRAFT' | 'RELEASE_READY' | 'RELEASED'

export type MilestoneType = 'MILESTONE' | 'ACHIEVEMENT'

export type MilestoneComparison = 'GTE' | 'LTE'

export type MilestoneStatus = 'DRAFT' | 'ACTIVE'

export type MapVoteAction = 'RANK' | 'UNRANK' | 'REWEIGHT'

export type VoteType = 'UPVOTE' | 'DOWNVOTE' | 'NEUTRAL'

export type CriteriaStatus = 'PENDING' | 'PASSED' | 'FAILED'

export type CurveType = 'POINT_LOOKUP' | 'FORMULA'

export type Difficulty = 'EASY' | 'NORMAL' | 'HARD' | 'EXPERT' | 'EXPERT_PLUS'

export type NewsStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export type NewsType =
  | 'BATCH'
  | 'CAMPAIGN'
  | 'MILESTONE_SET'
  | 'CURVE'
  | 'GENERAL'
  | 'ITEMS'
  | 'PLUGIN'

export type CampaignStatus = 'DRAFT' | 'PUBLISHED' | 'EDITING' | 'CURATED'

export type CampaignCompletionMode = 'TERMINAL' | 'ALL'

export type CampaignTagKind = 'CATEGORY' | 'DIFFICULTY' | 'THEME' | 'GENRE'

export type CampaignRequirementType = 'ACC' | 'AP' | 'SCORE' | 'STREAK_115' | 'FC' | 'RANK'

export type CampaignPrerequisiteMode = 'AND' | 'OR'

export type CheckpointLabelPosition = 'LEFT' | 'RIGHT' | 'UP' | 'DOWN' | 'NONE'

export type BarrierConditionType =
  | 'AVERAGE_ACC'
  | 'AVERAGE_AP'
  | 'AP_MAX'
  | 'ACC_MAX'
  | 'STREAK_115_AVERAGE'
  | 'STREAK_115_MAX'
  | 'FC'
  | 'AVERAGE_RANK'
  | 'MAX_RANK'

export type CampaignVoteDirection = 'UP' | 'DOWN'

export type CampaignLeaderboardBoard = 'COMPLETIONS' | 'AVG_ACCURACY' | 'AVG_AP' | 'PROGRESS'

export type CampaignCollaboratorStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED'

export type UserCampaignStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED'

export type SupersedesReason =
  | 'Score improved'
  | 'Worse score'
  | 'Partial attempt'
  | 'Complexity reweight'
  | 'XP curve update'
  | 'Statistics recalculated'
  | 'User merge'
