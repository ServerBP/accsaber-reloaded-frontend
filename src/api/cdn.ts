import type {
  CampaignDifficultyResponse,
  CampaignResponse,
} from '@/types/api/campaigns'
import type { UserResponse } from '@/types/api/users'
import { del, get, postMultipart } from './client'

export interface CdnLimits {
  maxUploadBytes: number
  maxDimension: number
  allowedMimeTypes: string[]
}

let limitsCache: Promise<CdnLimits> | null = null

export function getCdnLimits(): Promise<CdnLimits> {
  if (!limitsCache) {
    limitsCache = get<CdnLimits>('/cdn/limits').catch((err) => {
      limitsCache = null
      throw err
    })
  }
  return limitsCache
}

function multipartFile(file: File): FormData {
  const form = new FormData()
  form.append('file', file)
  return form
}

export function uploadCampaignBackground(
  campaignId: string,
  file: File,
): Promise<CampaignResponse> {
  return postMultipart<CampaignResponse>(
    `/campaigns/${campaignId}/background`,
    multipartFile(file),
  )
}

export function deleteCampaignBackground(
  campaignId: string,
): Promise<CampaignResponse> {
  return del<CampaignResponse>(`/campaigns/${campaignId}/background`)
}

export function uploadCampaignIcon(
  campaignId: string,
  file: File,
): Promise<CampaignResponse> {
  return postMultipart<CampaignResponse>(
    `/campaigns/${campaignId}/icon`,
    multipartFile(file),
  )
}

export function deleteCampaignIcon(
  campaignId: string,
): Promise<CampaignResponse> {
  return del<CampaignResponse>(`/campaigns/${campaignId}/icon`)
}

export function uploadCampaignCheckpointAvatar(
  difficultyId: string,
  file: File,
): Promise<CampaignDifficultyResponse> {
  return postMultipart<CampaignDifficultyResponse>(
    `/campaigns/difficulties/${difficultyId}/checkpoint-avatar`,
    multipartFile(file),
  )
}

export function deleteCampaignCheckpointAvatar(
  difficultyId: string,
): Promise<CampaignDifficultyResponse> {
  return del<CampaignDifficultyResponse>(
    `/campaigns/difficulties/${difficultyId}/checkpoint-avatar`,
  )
}

export function uploadCampaignNodeBorder(
  difficultyId: string,
  file: File,
): Promise<CampaignDifficultyResponse> {
  return postMultipart<CampaignDifficultyResponse>(
    `/campaigns/difficulties/${difficultyId}/node-border`,
    multipartFile(file),
  )
}

export function deleteCampaignNodeBorder(
  difficultyId: string,
): Promise<CampaignDifficultyResponse> {
  return del<CampaignDifficultyResponse>(`/campaigns/difficulties/${difficultyId}/node-border`)
}

export function uploadMyAvatar(file: File): Promise<UserResponse> {
  return postMultipart<UserResponse>('/users/me/avatar', multipartFile(file))
}
