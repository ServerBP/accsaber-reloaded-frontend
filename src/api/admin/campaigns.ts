import type { CreateCampaignRequest, CreateCampaignTagRequest } from '@/types/api/admin'
import type { CampaignResponse, CampaignTagResponse } from '@/types/api/campaigns'
import { patch, post } from '../client'
import { buildQuery } from '../utils'

export function createCampaign(req: CreateCampaignRequest): Promise<CampaignResponse> {
  return post<CampaignResponse>('/admin/campaigns', req)
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

export function setCampaignOfficial(campaignId: string, value: boolean): Promise<CampaignResponse> {
  return patch<CampaignResponse>(`/admin/campaigns/${campaignId}/official${buildQuery({ value })}`)
}

export function setCampaignLoved(campaignId: string, loved: boolean): Promise<CampaignResponse> {
  return patch<CampaignResponse>(`/admin/campaigns/${campaignId}/loved${buildQuery({ loved })}`)
}

export function createCampaignTag(req: CreateCampaignTagRequest): Promise<CampaignTagResponse> {
  return post<CampaignTagResponse>('/admin/campaigns/tags', req)
}
