import { parseApiError } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import type { CampaignResponse, CampaignVoteResponse } from '@/types/api/campaigns'
import type { CampaignVoteDirection } from '@/types/enums'
import { computed, onUnmounted, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

export function useCampaignVote(source: MaybeRefOrGetter<CampaignResponse | null | undefined>) {
  const auth = useAuthStore()

  const up = ref(0)
  const down = ref(0)
  const myVote = ref<CampaignVoteDirection | null>(null)
  const pending = ref(false)
  const error = ref<string | null>(null)
  let errorTimer: number | null = null

  watch(
    () => {
      const c = toValue(source)
      return c ? `${c.id}:${c.totalUpvotes}:${c.totalDownvotes}:${c.myVote ?? ''}` : ''
    },
    () => {
      if (pending.value) return
      const c = toValue(source)
      up.value = c?.totalUpvotes ?? 0
      down.value = c?.totalDownvotes ?? 0
      myVote.value = c?.myVote ?? null
    },
    { immediate: true },
  )

  const votable = computed(() => {
    const c = toValue(source)
    return !!c && (c.status === 'PUBLISHED' || c.status === 'CURATED')
  })

  const needsLogin = computed(() => !auth.isLoggedIn)
  const restricted = computed(() => auth.restricted)

  function showError(message: string) {
    error.value = message
    if (errorTimer != null) window.clearTimeout(errorTimer)
    errorTimer = window.setTimeout(() => {
      error.value = null
      errorTimer = null
    }, 4000)
  }

  function reconcile(campaign: CampaignResponse, tallies: CampaignVoteResponse) {
    up.value = tallies.totalUpvotes
    down.value = tallies.totalDownvotes
    myVote.value = tallies.myVote ?? null
    campaign.totalUpvotes = tallies.totalUpvotes
    campaign.totalDownvotes = tallies.totalDownvotes
    campaign.voteScore = tallies.voteScore
    campaign.myVote = tallies.myVote
  }

  async function toggle(direction: CampaignVoteDirection) {
    const campaign = toValue(source)
    if (!campaign || pending.value || restricted.value || !votable.value || needsLogin.value) {
      return
    }
    const prev = { up: up.value, down: down.value, myVote: myVote.value }
    const clearing = myVote.value === direction
    if (clearing) {
      if (direction === 'UP') up.value -= 1
      else down.value -= 1
      myVote.value = null
    } else {
      if (direction === 'UP') {
        up.value += 1
        if (prev.myVote === 'DOWN') down.value -= 1
      } else {
        down.value += 1
        if (prev.myVote === 'UP') up.value -= 1
      }
      myVote.value = direction
    }
    pending.value = true
    try {
      const { voteCampaign, clearCampaignVote } = await import('@/api/campaigns')
      const tallies = clearing
        ? await clearCampaignVote(campaign.id)
        : await voteCampaign(campaign.id, direction)
      if (tallies) reconcile(campaign, tallies)
    } catch (err) {
      up.value = prev.up
      down.value = prev.down
      myVote.value = prev.myVote
      const parsed = parseApiError(err, 'Vote failed, try again')
      showError(
        parsed.status === 403 ? 'Voting is unavailable for your account' : parsed.message,
      )
    } finally {
      pending.value = false
    }
  }

  onUnmounted(() => {
    if (errorTimer != null) window.clearTimeout(errorTimer)
  })

  return { up, down, myVote, pending, error, votable, needsLogin, restricted, toggle }
}
