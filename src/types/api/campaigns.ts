import type {
  CampaignCompletionMode,
  CampaignPrerequisiteMode,
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
  seekingCuration: boolean
  progressionAgnostic: boolean
  completionMode: CampaignCompletionMode
  legacy: boolean
  completionXp: number
  playlistExportEnabled: boolean
  difficultyCount: number
  tags: CampaignTagResponse[]
  backgroundUrl: string | null
  submittedAt: string | null
  curatedAt: string | null
  createdAt: string
}

export type CampaignNodeShape = 'hex' | 'square' | 'circle' | 'diamond'

export interface CampaignItemAwardResponse {
  itemId: string
  itemName: string
  quantity: number
}

export interface CampaignDifficultyResponse {
  id: string
  mapDifficultyId: string
  songName: string
  songAuthor: string
  mapAuthor: string
  coverUrl: string
  difficulty: string
  characteristic: string
  requirementType: CampaignRequirementType
  requirementValue: number
  description: string | null
  checkpointLabel: string | null
  checkpointAvatarUrl: string | null
  borderColor: string | null
  borderShape: string | null
  checkpointColor: string | null
  checkpointSize: string | null
  size: string | null
  positionX: number
  positionY: number
  xp: number
  prerequisiteCampaignDifficultyIds: string[]
  prerequisiteMode: CampaignPrerequisiteMode
  items: CampaignItemAwardResponse[]
}

export interface CampaignDetailResponse extends CampaignResponse {
  curatorNotes: string | null
  difficulties: CampaignDifficultyResponse[]
  completionItems: CampaignItemAwardResponse[]
}

export interface CampaignDifficultyProgressResponse {
  campaignDifficultyId: string
  mapDifficultyId: string
  songName: string
  difficulty: string
  characteristic: string
  requirementType: CampaignRequirementType
  requirementValue: number
  userValue: number | null
  userScore: number | null
  completed: boolean
  unlocked: boolean
  checkpointLabel: string | null
  checkpointAvatarUrl: string | null
}

export interface CampaignProgressResponse {
  campaignId: string
  campaignName: string
  campaignSlug: string
  status: UserCampaignStatus | null
  startedAt: string | null
  completedAt: string | null
  totalDifficulties: number
  completedDifficulties: number
  difficulties: CampaignDifficultyProgressResponse[]
}

export interface UserCampaignResponse {
  id: string
  campaignId: string
  campaignName: string
  campaignSlug: string
  status: UserCampaignStatus
  startedAt: string
  completedAt: string | null
  totalDifficulties: number
  completedDifficulties: number
}

export interface CampaignListParams extends PaginationParams {
  status?: CampaignStatus[]
  tagIds?: string[]
  creatorId?: string
}

export interface CampaignTagListParams {
  kind?: CampaignTagKind
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
