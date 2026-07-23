import {
  curateCampaign,
  deactivateCampaign,
  publishCampaign,
  reopenCampaignForEdit,
  setCampaignOfficial,
  uncurateCampaign,
} from '@/api/admin/campaigns'
import {
  deletePlayerCampaign,
  publishPlayerCampaign,
  unpublishPlayerCampaign,
} from '@/api/campaigns'
import { getApiErrorMessage } from '@/api/client'
import type { CampaignDetailResponse } from '@/types/api/campaigns'
import { ref, type Ref } from 'vue'

interface LifecycleContext {
  campaign: Ref<CampaignDetailResponse | null>
  actionPending: Ref<boolean>
  actionError: Ref<string | null>
  load: () => Promise<void>
  editedLiveCampaign: Ref<boolean>
  requirementDirtyIds: Ref<Set<string>>
}

export function useCampaignLifecycle(ctx: LifecycleContext) {
  const { campaign, actionPending, actionError, load } = ctx

  const showRepublishWarning = ref(false)
  const publishConfirm = ref<'publish' | 'unpublish' | null>(null)

  function doPlayerPublish() {
    if (!campaign.value) return
    if (ctx.editedLiveCampaign.value && ctx.requirementDirtyIds.value.size > 0) {
      showRepublishWarning.value = true
      return
    }
    publishConfirm.value = 'publish'
  }

  async function performPublish() {
    if (!campaign.value) return
    showRepublishWarning.value = false
    publishConfirm.value = null
    actionPending.value = true
    actionError.value = null
    try {
      await publishPlayerCampaign(campaign.value.id)
      await load()
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to publish campaign')
    } finally {
      actionPending.value = false
    }
  }

  function doPlayerUnpublish() {
    if (!campaign.value) return
    publishConfirm.value = 'unpublish'
  }

  async function performUnpublish() {
    if (!campaign.value) return
    publishConfirm.value = null
    actionPending.value = true
    actionError.value = null
    try {
      await unpublishPlayerCampaign(campaign.value.id)
      await load()
      ctx.editedLiveCampaign.value = true
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to unpublish campaign')
    } finally {
      actionPending.value = false
    }
  }

  async function deleteDraft() {
    if (!campaign.value) return
    if (!window.confirm('Delete this draft? This cannot be undone.')) return
    actionPending.value = true
    actionError.value = null
    try {
      await deletePlayerCampaign(campaign.value.id)
      window.location.assign('/campaigns')
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to delete draft')
    } finally {
      actionPending.value = false
    }
  }

  async function doPublish() {
    if (!campaign.value) return
    actionPending.value = true
    actionError.value = null
    try {
      await publishCampaign(campaign.value.id)
      await load()
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to publish campaign')
    } finally {
      actionPending.value = false
    }
  }

  async function doReopen() {
    if (!campaign.value) return
    actionPending.value = true
    actionError.value = null
    try {
      await reopenCampaignForEdit(campaign.value.id)
      await load()
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to reopen for editing')
    } finally {
      actionPending.value = false
    }
  }

  async function doCurate() {
    if (!campaign.value) return
    actionPending.value = true
    actionError.value = null
    try {
      await curateCampaign(campaign.value.id)
      await load()
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to curate campaign')
    } finally {
      actionPending.value = false
    }
  }

  async function doUncurate() {
    if (!campaign.value) return
    actionPending.value = true
    actionError.value = null
    try {
      await uncurateCampaign(campaign.value.id)
      await load()
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to uncurate campaign')
    } finally {
      actionPending.value = false
    }
  }

  async function doToggleOfficial() {
    if (!campaign.value) return
    actionPending.value = true
    actionError.value = null
    try {
      await setCampaignOfficial(campaign.value.id, !campaign.value.official)
      await load()
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to update official status')
    } finally {
      actionPending.value = false
    }
  }

  async function doDeactivate() {
    if (!campaign.value) return
    if (
      !window.confirm('Deactivate this campaign? It will be hidden but player progress preserved.')
    )
      return
    actionPending.value = true
    actionError.value = null
    try {
      await deactivateCampaign(campaign.value.id)
      await load()
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to deactivate campaign')
    } finally {
      actionPending.value = false
    }
  }

  return {
    showRepublishWarning,
    publishConfirm,
    doPlayerPublish,
    performPublish,
    doPlayerUnpublish,
    performUnpublish,
    deleteDraft,
    doPublish,
    doReopen,
    doCurate,
    doUncurate,
    doToggleOfficial,
    doDeactivate,
  }
}
