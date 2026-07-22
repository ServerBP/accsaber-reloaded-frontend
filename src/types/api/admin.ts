import type { BatchStatus, Difficulty, MapDifficultyStatus, MapVoteAction, StaffRole, StaffUserStatus, VoteType } from '../enums'

export interface CreateStaffUserRequest {
  username: string
  email: string
  password: string
  role: StaffRole
}

export interface UpdateStaffRoleRequest {
  role: StaffRole
}

export interface UpdateStaffStatusRequest {
  status: StaffUserStatus
}

export interface UpdateStaffActiveRequest {
  active: boolean
}

export interface LinkUserRequest {
  userId: string
}

export interface ForceChangePasswordRequest {
  newPassword: string
}

export interface OAuthLinkRequest {
  provider: string
  providerId: string
}

export interface StaffUserResponse {
  id: string
  username: string
  email: string
  role: StaffRole
  status: StaffUserStatus
  active: boolean
  userId: string | null
  oauthLinks: StaffOAuthLinkResponse[]
  createdAt: string
}

export interface StaffOAuthLinkResponse {
  id: string
  provider: string
  providerId: string
  createdAt: string
}

export interface ImportMapFromLeaderboardIdsRequest {
  ssLeaderboardId: string
  blLeaderboardId: string
  categoryId: string
  difficulty: Difficulty
  characteristic: string
  batchId?: string | null
}

export interface UpdateMapStatusRequest {
  status: MapDifficultyStatus
}

export interface UpdateMapComplexityRequest {
  complexity: number
}

export interface CreateBatchRequest {
  name: string
  description?: string
}

export interface UpdateBatchRequest {
  name: string
  description: string | null
}

export interface UpdateBatchStatusRequest {
  status: BatchStatus
}

export interface CastVoteRequest {
  vote: VoteType
  type: MapVoteAction
  suggestedComplexity?: number
  criteriaVote?: VoteType
  criteriaVoteOverride?: boolean
  reason?: string
}

export interface ApproveReweightRequest {
  complexity: number
}

export interface BulkReweightRequest {
  items: { mapDifficultyId: string; complexity: number }[]
  reason: string
}

export interface ApproveUnrankRequest {
  mapDifficultyId: string
}

export interface BulkUnrankRequest {
  mapDifficultyIds: string[]
}
export interface DuplicateCandidateResponse {
  primaryUserId: string
  primaryUserName: string
  secondaryUserId: string
  secondaryUserName: string
  country: string
  identicalScores: number
  primaryTotalScores: number
  secondaryTotalScores: number
}

export interface DuplicateLinkResponse {
  id: string
  primaryUserId: string
  primaryUserName: string
  secondaryUserId: string
  secondaryUserName: string
  merged: boolean
  mergedAt: string | null
  reason: string | null
  createdAt: string
}

export interface CreateDuplicateLinkRequest {
  primaryUserId: string
  secondaryUserId: string
  reason?: string
}

export interface MergeDuplicateRequest {
  primaryUserId: string
  secondaryUserId: string
  reason?: string
}
export interface CreateCurveRequest {
  name: string
  type: 'FORMULA' | 'POINT_LOOKUP'
  formula?: string
  xParameterName?: string
  xParameterValue?: number
  yParameterName?: string
  yParameterValue?: number
  zParameterName?: string
  zParameterValue?: number
  scale?: number
  shift?: number
}

export type UpdateCurveRequest = Partial<CreateCurveRequest>

export interface CreateMilestoneRequest {
  setId: string
  categoryId?: string
  title: string
  description: string
  type: string
  tier: string
  xp: number
  querySpec: Record<string, unknown>
  targetValue: number
  comparison: string
  blExclusive?: boolean
  mapDifficultyIds?: string[]
  awardsItemId?: string
}

export interface LinkMilestoneMapRequest {
  mapDifficultyIds: string[]
}

export interface UpdateMilestoneRequest {
  title?: string
  description?: string
  awardsItemId?: string
}

export interface CreateMilestoneSetRequest {
  title: string
  description: string
  setBonusXp: number
  awardsItemId?: string
}

export interface UpdateMilestoneSetRequest {
  title?: string
  description?: string
  setBonusXp?: number
  awardsItemId?: string
}

export interface CreatePrerequisiteRequest {
  milestoneId: string
  prerequisiteMilestoneId: string
  blocker: boolean
}

export interface UpdatePrerequisiteRequest {
  blocker: boolean
}

export type { ActivateMilestonesRequest, AdminMilestoneListParams } from './milestones'

import type {
  BarrierConditionType,
  CampaignCompletionMode,
  CampaignRequirementType,
  CampaignPrerequisiteMode,
  CampaignTagKind,
  CheckpointLabelPosition,
} from '../enums'

export interface CreateCampaignRequest {
  creatorId?: number
  creatorAlias?: string
  name: string
  slug?: string
  summary?: string
  description?: string
  progressionAgnostic?: boolean
  completionMode?: CampaignCompletionMode
  playlistExportEnabled?: boolean
  backgroundUrl?: string
  backgroundColor?: string
  tagIds?: string[]
}

export interface UpdateCampaignRequest {
  name?: string
  slug?: string
  summary?: string
  description?: string
  progressionAgnostic?: boolean
  completionMode?: CampaignCompletionMode
  playlistExportEnabled?: boolean
  completionXp?: number
  creatorAlias?: string
  seekingCuration?: boolean
  backgroundUrl?: string | null
  backgroundColor?: string | null
  tagIds?: string[]
}

export interface CampaignPrerequisiteInput {
  comesFromCampaignDifficultyId: string
  color?: string
}

export interface AddCampaignDifficultyRequest {
  mapDifficultyId: string
  requirementType: CampaignRequirementType
  requirementValue: number
  description?: string
  checkpointLabel?: string
  checkpointLabelPosition?: CheckpointLabelPosition
  checkpointAvatarUrl?: string
  checkpointColor?: string
  checkpointSize?: number
  borderColor?: string
  borderShape?: string
  size?: number
  positionX: number
  positionY: number
  xp?: number
  prerequisites?: CampaignPrerequisiteInput[]
  prerequisiteMode?: CampaignPrerequisiteMode
}

export interface UpdateCampaignDifficultyRequest {
  requirementType?: CampaignRequirementType
  requirementValue?: number
  description?: string | null
  checkpointLabel?: string | null
  checkpointLabelPosition?: CheckpointLabelPosition | null
  checkpointAvatarUrl?: string | null
  checkpointColor?: string | null
  checkpointSize?: number | null
  borderColor?: string | null
  borderShape?: string | null
  size?: number | null
  positionX?: number
  positionY?: number
  xp?: number
  prerequisites?: CampaignPrerequisiteInput[]
  prerequisiteMode?: CampaignPrerequisiteMode
}

export interface CreateCampaignTagRequest {
  kind: CampaignTagKind
  name: string
}

export interface AddCampaignItemRequest {
  itemId: string
  quantity?: number
}

export interface AddCampaignBarrierRequest {
  conditionType: BarrierConditionType
  conditionValue?: number | null
  description?: string
  checkpointLabel?: string
  checkpointLabelPosition?: CheckpointLabelPosition
  checkpointAvatarUrl?: string
  checkpointColor?: string
  borderColor?: string
  borderShape?: string
  size?: number
  checkpointSize?: number
  positionX: number
  positionY: number
  xp?: number
  prerequisites?: CampaignPrerequisiteInput[]
  affectedCampaignDifficultyIds?: string[]
}

export interface UpdateCampaignBarrierRequest {
  conditionType?: BarrierConditionType
  conditionValue?: number | null
  description?: string | null
  checkpointLabel?: string | null
  checkpointLabelPosition?: CheckpointLabelPosition | null
  checkpointAvatarUrl?: string | null
  checkpointColor?: string | null
  borderColor?: string | null
  borderShape?: string | null
  size?: number | null
  checkpointSize?: number | null
  positionX?: number
  positionY?: number
  xp?: number
  prerequisites?: CampaignPrerequisiteInput[]
  prerequisiteMode?: CampaignPrerequisiteMode
  affectedCampaignDifficultyIds?: string[]
}

export interface CampaignTextRequest {
  content?: string
  positionX: number
  positionY: number
  font?: string
  scale?: number
  color?: string
  effects?: string
}
