import {
  addCampaignCompletionItem,
  addCampaignDifficultyItem,
  removeCampaignCompletionItem,
  removeCampaignDifficultyItem,
} from '@/api/campaigns'
import { getApiErrorMessage } from '@/api/client'
import type {
  CampaignBarrierResponse,
  CampaignDetailResponse,
  CampaignDifficultyResponse,
} from '@/types/api/campaigns'
import { computed, ref, type ComputedRef, type Ref } from 'vue'

const NODE_REWARD_LIMIT = 3

interface RewardsContext {
  campaign: Ref<CampaignDetailResponse | null>
  ensureCampaign: () => Promise<CampaignDetailResponse | null>
  actionPending: Ref<boolean>
  actionError: Ref<string | null>
  editable: ComputedRef<boolean>
  selectedDifficulty: ComputedRef<CampaignDifficultyResponse | null>
  selectedBarrier: ComputedRef<CampaignBarrierResponse | null>
}

export function useCampaignRewards(ctx: RewardsContext) {
  const { campaign, ensureCampaign, actionPending, actionError, editable } = ctx
  const { selectedDifficulty, selectedBarrier } = ctx

  const itemPickerFor = ref<'campaign' | 'node' | 'barrier' | null>(null)

  const canAddNodeReward = computed(
    () => !!selectedDifficulty.value && selectedDifficulty.value.items.length < NODE_REWARD_LIMIT,
  )

  const canAddBarrierReward = computed(
    () => !!selectedBarrier.value && selectedBarrier.value.items.length < NODE_REWARD_LIMIT,
  )

  function openCampaignItemPicker() {
    if (!editable.value) return
    itemPickerFor.value = 'campaign'
  }

  function openNodeItemPicker() {
    if (!editable.value || !canAddNodeReward.value) return
    itemPickerFor.value = 'node'
  }

  function openBarrierItemPicker() {
    if (!editable.value || !canAddBarrierReward.value) return
    itemPickerFor.value = 'barrier'
  }

  async function handleItemPicked(payload: { itemId: string; quantity: number }) {
    if (itemPickerFor.value === 'campaign') {
      await addCompletionItem(payload)
    } else if (itemPickerFor.value === 'node') {
      await addNodeItem(payload)
    } else if (itemPickerFor.value === 'barrier') {
      await addBarrierItem(payload)
    }
    itemPickerFor.value = null
  }

  async function addCompletionItem(payload: { itemId: string; quantity: number }) {
    let c = campaign.value
    if (!c || c.id === '') {
      c = await ensureCampaign()
      if (!c) return
    }
    actionPending.value = true
    actionError.value = null
    try {
      const updated = await addCampaignCompletionItem(c.id, payload)
      if (campaign.value) {
        campaign.value = { ...campaign.value, completionItems: updated }
      }
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to add reward')
    } finally {
      actionPending.value = false
    }
  }

  async function removeCompletionItem(itemId: string) {
    if (!editable.value || !campaign.value) return
    const cId = campaign.value.id
    const prev = campaign.value.completionItems
    campaign.value = {
      ...campaign.value,
      completionItems: prev.filter((i) => i.itemId !== itemId),
    }
    try {
      actionError.value = null
      const updated = await removeCampaignCompletionItem(cId, itemId)
      if (campaign.value) {
        campaign.value = { ...campaign.value, completionItems: updated }
      }
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to remove reward')
      if (campaign.value) {
        campaign.value = { ...campaign.value, completionItems: prev }
      }
    }
  }

  async function addNodeItem(payload: { itemId: string; quantity: number }) {
    const d = selectedDifficulty.value
    if (!editable.value || !d || d.items.length >= NODE_REWARD_LIMIT) return
    const dId = d.id
    actionPending.value = true
    actionError.value = null
    try {
      const updated = await addCampaignDifficultyItem(dId, payload)
      if (campaign.value) {
        campaign.value = {
          ...campaign.value,
          difficulties: campaign.value.difficulties.map((row) =>
            row.id === dId ? { ...row, items: updated } : row,
          ),
        }
      }
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to add reward')
    } finally {
      actionPending.value = false
    }
  }

  async function removeNodeItem(itemId: string) {
    const d = selectedDifficulty.value
    if (!editable.value || !d || !campaign.value) return
    const dId = d.id
    const prevItems = d.items
    campaign.value = {
      ...campaign.value,
      difficulties: campaign.value.difficulties.map((row) =>
        row.id === dId ? { ...row, items: prevItems.filter((i) => i.itemId !== itemId) } : row,
      ),
    }
    try {
      actionError.value = null
      const updated = await removeCampaignDifficultyItem(dId, itemId)
      if (campaign.value) {
        campaign.value = {
          ...campaign.value,
          difficulties: campaign.value.difficulties.map((row) =>
            row.id === dId ? { ...row, items: updated } : row,
          ),
        }
      }
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to remove reward')
      if (campaign.value) {
        campaign.value = {
          ...campaign.value,
          difficulties: campaign.value.difficulties.map((row) =>
            row.id === dId ? { ...row, items: prevItems } : row,
          ),
        }
      }
    }
  }

  async function addBarrierItem(payload: { itemId: string; quantity: number }) {
    const b = selectedBarrier.value
    if (!editable.value || !b || b.items.length >= NODE_REWARD_LIMIT) return
    const bId = b.id
    actionPending.value = true
    actionError.value = null
    try {
      const updated = await addCampaignDifficultyItem(bId, payload)
      if (campaign.value) {
        campaign.value = {
          ...campaign.value,
          barriers: campaign.value.barriers.map((row) =>
            row.id === bId ? { ...row, items: updated } : row,
          ),
        }
      }
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to add reward')
    } finally {
      actionPending.value = false
    }
  }

  async function removeBarrierItem(itemId: string) {
    const b = selectedBarrier.value
    if (!editable.value || !b || !campaign.value) return
    const bId = b.id
    const prevItems = b.items
    campaign.value = {
      ...campaign.value,
      barriers: campaign.value.barriers.map((row) =>
        row.id === bId ? { ...row, items: prevItems.filter((i) => i.itemId !== itemId) } : row,
      ),
    }
    try {
      actionError.value = null
      const updated = await removeCampaignDifficultyItem(bId, itemId)
      if (campaign.value) {
        campaign.value = {
          ...campaign.value,
          barriers: campaign.value.barriers.map((row) =>
            row.id === bId ? { ...row, items: updated } : row,
          ),
        }
      }
    } catch (err) {
      actionError.value = getApiErrorMessage(err, 'Failed to remove reward')
      if (campaign.value) {
        campaign.value = {
          ...campaign.value,
          barriers: campaign.value.barriers.map((row) =>
            row.id === bId ? { ...row, items: prevItems } : row,
          ),
        }
      }
    }
  }

  return {
    itemPickerFor,
    canAddNodeReward,
    canAddBarrierReward,
    nodeRewardLimit: NODE_REWARD_LIMIT,
    openCampaignItemPicker,
    openNodeItemPicker,
    openBarrierItemPicker,
    handleItemPicked,
    removeCompletionItem,
    removeNodeItem,
    removeBarrierItem,
  }
}
