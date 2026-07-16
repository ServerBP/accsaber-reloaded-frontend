import type {
  BarrierConditionType,
  CampaignCollaboratorStatus,
  CampaignCompletionMode,
  CampaignLeaderboardBoard,
  CampaignPrerequisiteMode,
  CampaignVoteDirection,
  CheckpointLabelPosition,
  CampaignRequirementType,
  CampaignStatus,
  CampaignTagKind,
  Difficulty,
  UserCampaignStatus,
} from '../enums'
import type { PaginationParams } from '../pagination'

export interface CampaignTagResponse {
  id: string
  kind: CampaignTagKind
  name: string
  categoryId: string | null
  system: boolean
}

export interface CampaignResponse {
  id: string
  creatorId: string | null
  creatorName: string | null
  creatorAlias: string | null
  name: string
  slug: string
  summary: string | null
  description: string | null
  status: CampaignStatus
  official: boolean
  seekingCuration: boolean
  progressionAgnostic: boolean
  completionMode: CampaignCompletionMode
  legacy: boolean
  completionXp: number
  playlistExportEnabled: boolean
  difficultyCount: number
  tags: CampaignTagResponse[]
  backgroundUrl: string | null
  backgroundColor: string | null
  iconUrl: string | null
  submittedAt: string | null
  curatedAt: string | null
  createdAt: string
  totalUpvotes: number
  totalDownvotes: number
  voteScore: number
  myVote?: CampaignVoteDirection
}

export interface CampaignVoteResponse {
  campaignId: string
  totalUpvotes: number
  totalDownvotes: number
  voteScore: number
  myVote?: CampaignVoteDirection
}

export type CampaignNodeShape = 'hex' | 'square' | 'circle' | 'diamond'

export interface CampaignItemAwardResponse {
  itemId: string
  itemName: string
  quantity: number
}

export interface CampaignPrerequisiteResponse {
  comesFromCampaignDifficultyId: string
  color: string | null
}

export interface CampaignDifficultyResponse {
  id: string
  mapDifficultyId: string
  mapId: string
  categoryId: string | null
  complexity: number | null
  beatsaverCode: string | null
  maxScore: number | null
  songName: string
  songAuthor: string
  mapAuthor: string
  coverUrl: string
  cdnCoverUrl: string | null
  difficulty: string
  characteristic: string
  requirementType: CampaignRequirementType
  requirementValue: number
  description: string | null
  checkpointLabel: string | null
  checkpointLabelPosition: CheckpointLabelPosition | null
  checkpointAvatarUrl: string | null
  borderColor: string | null
  borderShape: string | null
  checkpointColor: string | null
  checkpointSize: number | null
  size: number | null
  positionX: number
  positionY: number
  xp: number
  prerequisites: CampaignPrerequisiteResponse[]
  prerequisiteMode: CampaignPrerequisiteMode
  items: CampaignItemAwardResponse[]
}

export interface CampaignBarrierResponse {
  id: string
  conditionType: BarrierConditionType
  conditionValue: number | null
  description: string | null
  checkpointLabel: string | null
  checkpointLabelPosition: CheckpointLabelPosition | null
  checkpointAvatarUrl: string | null
  checkpointColor: string | null
  borderColor: string | null
  borderShape: string | null
  size: number | null
  checkpointSize: number | null
  positionX: number
  positionY: number
  xp: number
  prerequisites: CampaignPrerequisiteResponse[]
  prerequisiteMode: CampaignPrerequisiteMode
  affectedCampaignDifficultyIds: string[]
  items: CampaignItemAwardResponse[]
}

export interface CampaignTextResponse {
  id: string
  content: string
  positionX: number
  positionY: number
  font: string | null
  scale: number | null
  color: string | null
  effects: string | null
}

export interface CampaignDetailResponse extends CampaignResponse {
  curatorNotes: string | null
  difficulties: CampaignDifficultyResponse[]
  barriers: CampaignBarrierResponse[]
  texts: CampaignTextResponse[]
  completionItems: CampaignItemAwardResponse[]
}

export interface CampaignDifficultyProgressResponse {
  node: CampaignDifficultyResponse
  userValue: number | null
  userScore: number | null
  completed: boolean
  unlocked: boolean
}

export interface BarrierProgressResponse {
  barrier: CampaignBarrierResponse
  currentValue: number | null
  satisfied: boolean
  unlocked: boolean
}

export interface CampaignProgressResponse {
  id: string
  campaign: CampaignResponse
  progressStatus: UserCampaignStatus | null
  startedAt: string | null
  completedAt: string | null
  completedDifficulties: number
  difficulties: CampaignDifficultyProgressResponse[]
  barriers: BarrierProgressResponse[]
}

export interface UserCampaignResponse {
  id: string
  campaign: CampaignResponse
  progressStatus: UserCampaignStatus
  startedAt: string
  completedAt: string | null
  completedDifficulties: number
}

export interface CampaignProgressSummary {
  progressStatus: UserCampaignStatus | null
  completedDifficulties: number
}

export interface CampaignCollaboratorResponse {
  id: string
  campaignId: string
  campaignName: string
  campaignSlug: string
  userId: string
  userName: string
  userAvatarUrl: string | null
  userCdnAvatarUrl: string | null
  userCountry: string | null
  status: CampaignCollaboratorStatus
  invitedById: string
  createdAt: string
}

export interface InviteCampaignCollaboratorRequest {
  userId: string
}

export interface CampaignChatMessageResponse {
  id: string
  campaignId: string
  authorId: string
  authorName: string
  authorAvatarUrl: string | null
  authorCdnAvatarUrl: string | null
  content: string
  createdAt: string
}

export interface SendCampaignChatRequest {
  content: string
}

export interface CampaignCollaborationListParams extends PaginationParams {
  status?: CampaignCollaboratorStatus
}

export interface CampaignListParams extends PaginationParams {
  status?: CampaignStatus[]
  tagIds?: string[]
  creatorId?: string
  search?: string
  official?: boolean
}

export interface CampaignTagListParams {
  kind?: CampaignTagKind
}

export interface CampaignLeaderboardPlayer {
  userId: string
  userName: string
  country?: string
  avatarUrl?: string
  cdnAvatarUrl?: string
}

export interface CampaignLeaderboardEntry {
  rank?: number
  player: CampaignLeaderboardPlayer
  completedAt?: string
  averageAccuracy?: number
  averageAp?: number
  nodesCounted?: number
  progressStatus?: 'IN_PROGRESS' | 'COMPLETED'
  completedNodes?: number
  totalNodes?: number
}

export interface CampaignNodeScoreEntry {
  rank: number
  player: CampaignLeaderboardPlayer
  score?: number
  accuracy?: number
  ap?: number
}

export interface CampaignLeaderboardParams extends PaginationParams {
  board?: CampaignLeaderboardBoard
}

export interface CampaignMapResponse {
  id: string
  mapDifficultyId: string
  songName: string
  songAuthor: string
  mapAuthor: string
  coverUrl: string
  cdnCoverUrl?: string | null
  difficulty: Difficulty
  characteristic: string
  accuracyRequirement: number
  xp: number
  prerequisiteMapIds: string[]
}
