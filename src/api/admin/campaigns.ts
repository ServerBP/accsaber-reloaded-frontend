import type {
  AddCampaignDifficultyRequest,
  CreateCampaignRequest,
  CreateCampaignTagRequest,
  UpdateCampaignDifficultyRequest,
  UpdateCampaignRequest,
} from '@/types/api/admin'
import type {
  CampaignDifficultyResponse,
  CampaignResponse,
  CampaignTagResponse,
} from '@/types/api/campaigns'
import { patch, post } from '../client'

export function createCampaign(req: CreateCampaignRequest): Promise<CampaignResponse> {
  return post<CampaignResponse>('/admin/campaigns', req)
}

export function updateCampaign(
  campaignId: string,
  req: UpdateCampaignRequest,
): Promise<CampaignResponse> {
  return patch<CampaignResponse>(`/admin/campaigns/${campaignId}`, req)
}

export function publishCampaign(campaignId: string): Promise<CampaignResponse> {
  return patch<CampaignResponse>(`/admin/campaigns/${campaignId}/publish`)
}

export function reopenCampaignForEdit(campaignId: string): Promise<CampaignResponse> {
  return patch<CampaignResponse>(`/admin/campaigns/${campaignId}/edit`)
}

export function curateCampaign(campaignId: string): Promise<CampaignResponse> {
  return patch<CampaignResponse>(`/admin/campaigns/${campaignId}/curate`)
}

export function deactivateCampaign(campaignId: string): Promise<void> {
  return patch<void>(`/admin/campaigns/${campaignId}/deactivate`)
}

export function addCampaignDifficulty(
  campaignId: string,
  req: AddCampaignDifficultyRequest,
): Promise<CampaignDifficultyResponse> {
  return post<CampaignDifficultyResponse>(
    `/admin/campaigns/${campaignId}/difficulties`,
    req,
  )
}

export function updateCampaignDifficulty(
  difficultyId: string,
  req: UpdateCampaignDifficultyRequest,
): Promise<CampaignDifficultyResponse> {
  return patch<CampaignDifficultyResponse>(
    `/admin/campaigns/difficulties/${difficultyId}`,
    req,
  )
}

export function deactivateCampaignDifficulty(
  campaignId: string,
  difficultyId: string,
): Promise<void> {
  return patch<void>(
    `/admin/campaigns/${campaignId}/difficulties/${difficultyId}/deactivate`,
  )
}

export function createCampaignTag(req: CreateCampaignTagRequest): Promise<CampaignTagResponse> {
  return post<CampaignTagResponse>('/admin/campaigns/tags', req)
}
