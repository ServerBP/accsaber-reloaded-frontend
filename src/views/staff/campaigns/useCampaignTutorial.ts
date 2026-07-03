import { ref } from 'vue'
import { useRoute } from 'vue-router'

const STORAGE_KEY = 'campaign-tutorial:state'

export type CampaignTutorialOutcome = 'done' | 'skipped'

export function useCampaignTutorial() {
  const route = useRoute()
  const showTutorial = ref(false)

  function openTutorial() {
    showTutorial.value = true
  }

  function closeTutorial(outcome: CampaignTutorialOutcome) {
    showTutorial.value = false
    try {
      localStorage.setItem(STORAGE_KEY, outcome)
    } catch {}
  }

  function hasSeenTutorial(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) != null
    } catch {
      return true
    }
  }

  async function maybeAutoShow(userId: string | null) {
    if (route.name !== 'campaign-new') return
    if (!userId) return
    if (hasSeenTutorial()) return
    if (window.matchMedia('(max-width: 860px)').matches) return
    try {
      const { getCampaigns } = await import('@/api/campaigns')
      const page = await getCampaigns({ creatorId: userId, page: 0, size: 1 })
      if (page.totalElements === 0) showTutorial.value = true
    } catch {}
  }

  return { showTutorial, openTutorial, closeTutorial, maybeAutoShow }
}
