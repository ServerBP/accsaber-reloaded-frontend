import type {
  AddCampaignBarrierRequest,
  AddCampaignDifficultyRequest,
  AddCampaignItemRequest,
  CampaignTextRequest,
  CreateCampaignRequest,
  UpdateCampaignBarrierRequest,
  UpdateCampaignDifficultyRequest,
  UpdateCampaignRequest,
} from '@/types/api/admin'
import type {
  CampaignBarrierResponse,
  CampaignChatMessageResponse,
  CampaignCollaborationListParams,
  CampaignCollaboratorResponse,
  CampaignDetailResponse,
  CampaignDifficultyResponse,
  CampaignItemAwardResponse,
  CampaignLeaderboardEntry,
  CampaignLeaderboardParams,
  CampaignListParams,
  CampaignNodeScoreEntry,
  CampaignProgressResponse,
  CampaignResponse,
  CampaignTagListParams,
  CampaignTagResponse,
  CampaignTextResponse,
  CampaignVoteResponse,
  ImportCampaignMapRequest,
  InviteCampaignCollaboratorRequest,
  SendCampaignChatRequest,
  UserCampaignResponse,
} from '@/types/api/campaigns'
import type { PublicMapDifficultyResponse } from '@/types/api/maps'
import type { CampaignVoteDirection } from '@/types/enums'
import type { PaginationParams } from '@/types/pagination'
import type { Page } from '@/types/pagination'
import { ApiError, del, get, patch, post, put } from './client'
import { buildQuery } from './utils'
import { isUuid } from '@/utils/mapRoute'

export function getCampaigns(params?: CampaignListParams): Promise<Page<CampaignResponse>> {
  return get<Page<CampaignResponse>>(`/campaigns${buildQuery(params)}`)
}

export function getCampaign(campaignId: string): Promise<CampaignDetailResponse> {
  return get<CampaignDetailResponse>(`/campaigns/${campaignId}`)
}

export function getCampaignBySlug(slug: string): Promise<CampaignDetailResponse> {
  return get<CampaignDetailResponse>(`/campaigns/slug/${slug}`)
}

export async function getCampaignByIdOrSlug(value: string): Promise<CampaignDetailResponse> {
  if (isUuid(value)) {
    try {
      return await getCampaign(value)
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return getCampaignBySlug(value)
      throw e
    }
  }
  return getCampaignBySlug(value)
}

export function getCampaignTags(params?: CampaignTagListParams): Promise<CampaignTagResponse[]> {
  return get<CampaignTagResponse[]>(`/campaigns/tags${buildQuery(params)}`)
}

export function getMyCampaigns(params?: PaginationParams): Promise<Page<UserCampaignResponse>> {
  return get<Page<UserCampaignResponse>>(`/campaigns/me${buildQuery(params)}`)
}

export function getMyCampaignProgress(campaignId: string): Promise<CampaignProgressResponse> {
  return get<CampaignProgressResponse>(`/campaigns/${campaignId}/me/progress`)
}

const BULK_PROGRESS_CHUNK = 50

export async function getMyCampaignProgressBulk(
  ids: string[],
): Promise<CampaignProgressResponse[]> {
  if (ids.length === 0) return []
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += BULK_PROGRESS_CHUNK) {
    chunks.push(ids.slice(i, i + BULK_PROGRESS_CHUNK))
  }
  const results = await Promise.all(
    chunks.map((chunk) =>
      get<CampaignProgressResponse[]>(`/campaigns/me/progress${buildQuery({ ids: chunk })}`),
    ),
  )
  return results.flat()
}

export function getCampaignLeaderboard(
  campaignId: string,
  params?: CampaignLeaderboardParams,
): Promise<Page<CampaignLeaderboardEntry>> {
  return get<Page<CampaignLeaderboardEntry>>(
    `/campaigns/${campaignId}/leaderboard${buildQuery(params)}`,
  )
}

export function getCampaignNodeLeaderboard(
  campaignId: string,
  nodeId: string,
  params?: PaginationParams,
): Promise<Page<CampaignNodeScoreEntry>> {
  return get<Page<CampaignNodeScoreEntry>>(
    `/campaigns/${campaignId}/leaderboard/nodes/${nodeId}${buildQuery(params)}`,
  )
}

export function voteCampaign(
  campaignId: string,
  direction: CampaignVoteDirection,
): Promise<CampaignVoteResponse> {
  return put<CampaignVoteResponse>(`/campaigns/${campaignId}/vote`, { direction })
}

export function clearCampaignVote(campaignId: string): Promise<CampaignVoteResponse> {
  return del<CampaignVoteResponse>(`/campaigns/${campaignId}/vote`)
}

export function startCampaign(campaignId: string): Promise<void> {
  return post<void>(`/campaigns/${campaignId}/start`)
}

export function abandonCampaign(campaignId: string): Promise<void> {
  return del<void>(`/campaigns/${campaignId}/start`)
}

export function getPlaylistExportUrl(campaignId: string): string {
  const base = import.meta.env.VITE_API_BASE
  return `${base}/playlists/campaign/${campaignId}`
}

export function createPlayerCampaign(req: CreateCampaignRequest): Promise<CampaignResponse> {
  return post<CampaignResponse>('/campaigns', req)
}

export function updatePlayerCampaign(
  campaignId: string,
  req: UpdateCampaignRequest,
): Promise<CampaignResponse> {
  return patch<CampaignResponse>(`/campaigns/${campaignId}`, req)
}

export function deletePlayerCampaign(campaignId: string): Promise<void> {
  return del<void>(`/campaigns/${campaignId}`)
}

export function publishPlayerCampaign(campaignId: string): Promise<CampaignResponse> {
  return patch<CampaignResponse>(`/campaigns/${campaignId}/publish`)
}

export function unpublishPlayerCampaign(campaignId: string): Promise<CampaignResponse> {
  return patch<CampaignResponse>(`/campaigns/${campaignId}/unpublish`)
}

export function importCampaignMap(
  req: ImportCampaignMapRequest,
): Promise<PublicMapDifficultyResponse> {
  return post<PublicMapDifficultyResponse>('/campaigns/maps/import', req)
}

export function updateCampaignDifficultyMap(
  campaignDifficultyId: string,
  req: ImportCampaignMapRequest,
): Promise<CampaignDifficultyResponse> {
  return put<CampaignDifficultyResponse>(
    `/campaigns/difficulties/${campaignDifficultyId}/map`,
    req,
  )
}

export function addPlayerCampaignDifficulty(
  campaignId: string,
  req: AddCampaignDifficultyRequest,
): Promise<CampaignDifficultyResponse> {
  return post<CampaignDifficultyResponse>(`/campaigns/${campaignId}/difficulties`, req)
}

export function updatePlayerCampaignDifficulty(
  difficultyId: string,
  req: UpdateCampaignDifficultyRequest,
): Promise<CampaignDifficultyResponse> {
  return patch<CampaignDifficultyResponse>(
    `/campaigns/difficulties/${difficultyId}`,
    req,
  )
}

export function deletePlayerCampaignDifficulty(
  campaignId: string,
  difficultyId: string,
): Promise<void> {
  return del<void>(`/campaigns/${campaignId}/difficulties/${difficultyId}`)
}

export function addCampaignCompletionItem(
  campaignId: string,
  req: AddCampaignItemRequest,
): Promise<CampaignItemAwardResponse[]> {
  return post<CampaignItemAwardResponse[]>(`/campaigns/${campaignId}/completion-items`, req)
}

export function removeCampaignCompletionItem(
  campaignId: string,
  itemId: string,
): Promise<CampaignItemAwardResponse[]> {
  return del<CampaignItemAwardResponse[]>(`/campaigns/${campaignId}/completion-items/${itemId}`)
}

export function addCampaignDifficultyItem(
  difficultyId: string,
  req: AddCampaignItemRequest,
): Promise<CampaignItemAwardResponse[]> {
  return post<CampaignItemAwardResponse[]>(
    `/campaigns/difficulties/${difficultyId}/items`,
    req,
  )
}

export function removeCampaignDifficultyItem(
  difficultyId: string,
  itemId: string,
): Promise<CampaignItemAwardResponse[]> {
  return del<CampaignItemAwardResponse[]>(`/campaigns/difficulties/${difficultyId}/items/${itemId}`)
}

export function getCampaignCollaborators(
  campaignId: string,
): Promise<CampaignCollaboratorResponse[]> {
  return get<CampaignCollaboratorResponse[]>(`/campaigns/${campaignId}/collaborators`)
}

export function inviteCampaignCollaborator(
  campaignId: string,
  req: InviteCampaignCollaboratorRequest,
): Promise<CampaignCollaboratorResponse> {
  return post<CampaignCollaboratorResponse>(`/campaigns/${campaignId}/collaborators`, req)
}

export function respondToCampaignCollaboration(
  campaignId: string,
  accept: boolean,
): Promise<CampaignCollaboratorResponse> {
  return patch<CampaignCollaboratorResponse>(
    `/campaigns/${campaignId}/collaborators/me${buildQuery({ accept })}`,
  )
}

export function removeCampaignCollaborator(campaignId: string, userId: string): Promise<void> {
  return del<void>(`/campaigns/${campaignId}/collaborators/${userId}`)
}

export function getMyCollaborations(
  params?: CampaignCollaborationListParams,
): Promise<Page<CampaignCollaboratorResponse>> {
  return get<Page<CampaignCollaboratorResponse>>(
    `/campaigns/me/collaborations${buildQuery(params)}`,
  )
}

export function getCampaignChat(
  campaignId: string,
  params?: PaginationParams,
): Promise<Page<CampaignChatMessageResponse>> {
  return get<Page<CampaignChatMessageResponse>>(
    `/campaigns/${campaignId}/chat${buildQuery(params)}`,
  )
}

export function sendCampaignChatMessage(
  campaignId: string,
  req: SendCampaignChatRequest,
): Promise<CampaignChatMessageResponse> {
  return post<CampaignChatMessageResponse>(`/campaigns/${campaignId}/chat`, req)
}

export function addPlayerCampaignBarrier(
  campaignId: string,
  req: AddCampaignBarrierRequest,
): Promise<CampaignBarrierResponse> {
  return post<CampaignBarrierResponse>(`/campaigns/${campaignId}/barriers`, req)
}

export function updatePlayerCampaignBarrier(
  barrierId: string,
  req: UpdateCampaignBarrierRequest,
): Promise<CampaignBarrierResponse> {
  return patch<CampaignBarrierResponse>(`/campaigns/barriers/${barrierId}`, req)
}

export function deletePlayerCampaignBarrier(campaignId: string, barrierId: string): Promise<void> {
  return del<void>(`/campaigns/${campaignId}/barriers/${barrierId}`)
}

export function addPlayerCampaignText(
  campaignId: string,
  req: CampaignTextRequest,
): Promise<CampaignTextResponse> {
  return post<CampaignTextResponse>(`/campaigns/${campaignId}/texts`, req)
}

export function updatePlayerCampaignText(
  textId: string,
  req: CampaignTextRequest,
): Promise<CampaignTextResponse> {
  return patch<CampaignTextResponse>(`/campaigns/texts/${textId}`, req)
}

export function deletePlayerCampaignText(campaignId: string, textId: string): Promise<void> {
  return del<void>(`/campaigns/${campaignId}/texts/${textId}`)
}
