import {
  deleteCampaignBackground,
  deleteCampaignIcon,
  uploadCampaignBackground,
  uploadCampaignIcon,
} from '@/api/cdn'
import type { CampaignDetailResponse } from '@/types/api/campaigns'
import type { ComputedRef, Ref } from 'vue'

interface AssetsContext {
  campaign: Ref<CampaignDetailResponse | null>
  load: () => Promise<void>
  useAdminEndpoint: ComputedRef<boolean>
}

export function useCampaignAssets(ctx: AssetsContext) {
  const { campaign, load, useAdminEndpoint } = ctx

  async function uploadBackground(file: File) {
    if (!campaign.value) return
    await uploadCampaignBackground(campaign.value.id, file, useAdminEndpoint.value)
    await load()
  }

  async function removeBackground() {
    if (!campaign.value) return
    await deleteCampaignBackground(campaign.value.id, useAdminEndpoint.value)
    await load()
  }

  async function uploadIcon(file: File) {
    if (!campaign.value) return
    await uploadCampaignIcon(campaign.value.id, file, useAdminEndpoint.value)
    await load()
  }

  async function removeIcon() {
    if (!campaign.value) return
    await deleteCampaignIcon(campaign.value.id, useAdminEndpoint.value)
    await load()
  }

  return { uploadBackground, removeBackground, uploadIcon, removeIcon }
}
