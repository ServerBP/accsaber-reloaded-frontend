import {
  deleteCampaignBackground,
  deleteCampaignIcon,
  uploadCampaignBackground,
  uploadCampaignIcon,
} from '@/api/cdn'
import type { CampaignDetailResponse } from '@/types/api/campaigns'
import type { Ref } from 'vue'

interface AssetsContext {
  campaign: Ref<CampaignDetailResponse | null>
  load: () => Promise<void>
}

export function useCampaignAssets(ctx: AssetsContext) {
  const { campaign, load } = ctx

  async function uploadBackground(file: File) {
    if (!campaign.value) return
    await uploadCampaignBackground(campaign.value.id, file)
    await load()
  }

  async function removeBackground() {
    if (!campaign.value) return
    await deleteCampaignBackground(campaign.value.id)
    await load()
  }

  async function uploadIcon(file: File) {
    if (!campaign.value) return
    await uploadCampaignIcon(campaign.value.id, file)
    await load()
  }

  async function removeIcon() {
    if (!campaign.value) return
    await deleteCampaignIcon(campaign.value.id)
    await load()
  }

  return { uploadBackground, removeBackground, uploadIcon, removeIcon }
}
