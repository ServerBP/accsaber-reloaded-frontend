import { getCampaignChat, sendCampaignChatMessage } from '@/api/campaigns'
import { parseApiError } from '@/api/client'
import type { CampaignChatMessageResponse } from '@/types/api/campaigns'
import { isUuid } from '@/utils/mapRoute'
import { computed, ref, watch, type Ref } from 'vue'

const PAGE_SIZE = 20

function orderMessages(
  a: CampaignChatMessageResponse,
  b: CampaignChatMessageResponse,
): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1
  return a.id.localeCompare(b.id, undefined, { numeric: true })
}

export function useCampaignChat(campaignId: Ref<string | null | undefined>) {
  const byId = ref(new Map<string, CampaignChatMessageResponse>())
  const messages = computed(() => [...byId.value.values()].sort(orderMessages))

  const loading = ref(false)
  const loadingMore = ref(false)
  const sending = ref(false)
  const loaded = ref(false)
  const hasMore = ref(false)
  const error = ref<string | null>(null)
  const contentError = ref<string | null>(null)

  let nextPage = 0

  function addMessage(message: CampaignChatMessageResponse) {
    if (byId.value.has(message.id)) return
    const next = new Map(byId.value)
    next.set(message.id, message)
    byId.value = next
  }

  function addMany(list: CampaignChatMessageResponse[]) {
    if (list.length === 0) return
    const next = new Map(byId.value)
    for (const m of list) if (!next.has(m.id)) next.set(m.id, m)
    byId.value = next
  }

  function reset() {
    byId.value = new Map()
    loaded.value = false
    hasMore.value = false
    error.value = null
    contentError.value = null
    nextPage = 0
  }

  function currentId(): string | null {
    const id = campaignId.value
    return id && isUuid(id) ? id : null
  }

  async function loadHistory() {
    const id = currentId()
    if (!id || loaded.value || loading.value) return
    loading.value = true
    error.value = null
    try {
      const page = await getCampaignChat(id, { page: 0, size: PAGE_SIZE })
      addMany(page.content)
      hasMore.value = !page.last
      nextPage = 1
      loaded.value = true
    } catch (err) {
      error.value = parseApiError(err, 'Failed to load chat').message
    } finally {
      loading.value = false
    }
  }

  async function loadOlder() {
    const id = currentId()
    if (!id || !hasMore.value || loadingMore.value) return
    loadingMore.value = true
    error.value = null
    try {
      const page = await getCampaignChat(id, { page: nextPage, size: PAGE_SIZE })
      addMany(page.content)
      hasMore.value = !page.last
      nextPage += 1
    } catch (err) {
      error.value = parseApiError(err, 'Failed to load earlier messages').message
    } finally {
      loadingMore.value = false
    }
  }

  async function send(content: string): Promise<boolean> {
    const id = currentId()
    const trimmed = content.trim()
    if (!id || !trimmed || sending.value) return false
    sending.value = true
    contentError.value = null
    error.value = null
    try {
      const created = await sendCampaignChatMessage(id, { content: trimmed })
      addMessage(created)
      return true
    } catch (err) {
      const parsed = parseApiError(err, 'Failed to send message')
      const field = parsed.fieldErrors.find((f) => f.field === 'content')
      if (field) contentError.value = field.message
      else error.value = parsed.message
      return false
    } finally {
      sending.value = false
    }
  }

  function ingest(message: CampaignChatMessageResponse) {
    addMessage(message)
  }

  watch(campaignId, reset)

  return {
    messages,
    loading,
    loadingMore,
    sending,
    hasMore,
    error,
    contentError,
    loadHistory,
    loadOlder,
    send,
    ingest,
  }
}

export type UseCampaignChatReturn = ReturnType<typeof useCampaignChat>
