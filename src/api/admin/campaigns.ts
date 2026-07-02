import type {
  AddCampaignBarrierRequest,
  AddCampaignDifficultyRequest,
  CampaignTextRequest,
  CreateCampaignRequest,
  CreateCampaignTagRequest,
  UpdateCampaignBarrierRequest,
  UpdateCampaignDifficultyRequest,
  UpdateCampaignRequest,
} from '@/types/api/admin'
import type {
  CampaignBarrierResponse,
  CampaignDifficultyResponse,
  CampaignResponse,
  CampaignTagResponse,
  CampaignTextResponse,
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

export function uncurateCampaign(campaignId: string): Promise<CampaignResponse> {
  return patch<CampaignResponse>(`/admin/campaigns/${campaignId}/uncurate`)
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

export function addCampaignBarrier(
  campaignId: string,
  req: AddCampaignBarrierRequest,
): Promise<CampaignBarrierResponse> {
  return post<CampaignBarrierResponse>(`/admin/campaigns/${campaignId}/barriers`, req)
}

export function updateCampaignBarrier(
  barrierId: string,
  req: UpdateCampaignBarrierRequest,
): Promise<CampaignBarrierResponse> {
  return patch<CampaignBarrierResponse>(`/admin/campaigns/barriers/${barrierId}`, req)
}

export function deactivateCampaignBarrier(campaignId: string, barrierId: string): Promise<void> {
  return patch<void>(`/admin/campaigns/${campaignId}/barriers/${barrierId}/deactivate`)
}

export function addCampaignText(
  campaignId: string,
  req: CampaignTextRequest,
): Promise<CampaignTextResponse> {
  return post<CampaignTextResponse>(`/admin/campaigns/${campaignId}/texts`, req)
}

export function updateCampaignText(
  textId: string,
  req: CampaignTextRequest,
): Promise<CampaignTextResponse> {
  return patch<CampaignTextResponse>(`/admin/campaigns/texts/${textId}`, req)
}

export function deactivateCampaignText(campaignId: string, textId: string): Promise<void> {
  return patch<void>(`/admin/campaigns/${campaignId}/texts/${textId}/deactivate`)
}
