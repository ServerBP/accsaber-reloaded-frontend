import { getApiErrorMessage } from '@/api/client'
import {
  getCampaignCollaborators,
  inviteCampaignCollaborator,
  removeCampaignCollaborator,
} from '@/api/campaigns'
import type { useAuthStore } from '@/stores/auth'
import type { CampaignCollaboratorResponse, CampaignDetailResponse } from '@/types/api/campaigns'
import { computed, ref, type ComputedRef, type Ref } from 'vue'

const MAX_COLLABORATORS = 15

interface CollaboratorsContext {
  campaign: Ref<CampaignDetailResponse | null>
  auth: ReturnType<typeof useAuthStore>
  isCurator: ComputedRef<boolean>
  isCreator: ComputedRef<boolean>
  actionPending: Ref<boolean>
  actionError: Ref<string | null>
}

export function useCampaignCollaborators(ctx: CollaboratorsContext) {
  const { campaign, auth, isCurator, isCreator, actionPending, actionError } = ctx

  const collaborators = ref<CampaignCollaboratorResponse[]>([])
  const collaboratorsLoading = ref(false)
  const showCollaboratorPicker = ref(false)

  async function loadCollaborators() {
    const c = campaign.value
    if (!c || c.id === '' || (!auth.isLoggedIn && !isCurator.value)) {
      collaborators.value = []
      return
    }
    collaboratorsLoading.value = true
    try {
      collaborators.value = await getCampaignCollaborators(c.id)
    } catch {
      collaborators.value = []
    } finally {
      collaboratorsLoading.value = false
    }
  }

  const activeCollaborators = computed(() =>
    collaborators.value.filter((c) => c.status !== 'DECLINED'),
  )

  const isCollaborator = computed(() => {
    if (!auth.userId) return false
    return collaborators.value.some(
      (c) => c.status === 'ACCEPTED' && String(c.userId) === String(auth.userId),
    )
  })

  const canInviteMore = computed(() => activeCollaborators.value.length < MAX_COLLABORATORS)

  const existingCollaboratorIds = computed(() => {
    const ids = new Set<string>()
    if (campaign.value?.creatorId) ids.add(String(campaign.value.creatorId))
    for (const c of activeCollaborators.value) ids.add(String(c.userId))
    return ids
  })

  function openCollaboratorPicker() {
    if (!isCreator.value || !canInviteMore.value) return
    showCollaboratorPicker.value = true
  }

  async function handleCollaboratorPicked(userId: string) {
    const c = campaign.value
    if (!c || c.id === '') return
    actionPending.value = true
    actionError.value = null
    try {
      await inviteCampaignCollaborator(c.id, { userId })
      await loadCollaborators()
      showCollaboratorPicker.value = false
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to invite collaborator')
    } finally {
      actionPending.value = false
    }
  }

  async function removeCollaborator(userId: string) {
    const c = campaign.value
    if (!isCreator.value || !c) return
    const row = collaborators.value.find((x) => String(x.userId) === String(userId))
    if (!window.confirm(`Remove ${row?.userName ?? 'this collaborator'} from this campaign?`)) return
    actionPending.value = true
    actionError.value = null
    try {
      await removeCampaignCollaborator(c.id, userId)
      await loadCollaborators()
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to remove collaborator')
    } finally {
      actionPending.value = false
    }
  }

  async function leaveCampaign() {
    const c = campaign.value
    if (!c || !auth.userId) return
    if (!window.confirm('Leave this campaign? You will lose edit access.')) return
    actionPending.value = true
    actionError.value = null
    try {
      await removeCampaignCollaborator(c.id, String(auth.userId))
      window.location.assign('/campaigns')
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to leave campaign')
      actionPending.value = false
    }
  }

  return {
    collaboratorsLoading,
    showCollaboratorPicker,
    activeCollaborators,
    isCollaborator,
    canInviteMore,
    existingCollaboratorIds,
    collaboratorLimit: MAX_COLLABORATORS,
    loadCollaborators,
    openCollaboratorPicker,
    handleCollaboratorPicked,
    removeCollaborator,
    leaveCampaign,
  }
}
