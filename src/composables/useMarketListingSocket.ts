import type { MarketListingEvent } from '@/types/api/market'
import type { ConnectionStatus } from '@/types/display'
import { parseSocketJson, wsOrigin } from '@/utils/ws'
import { onUnmounted, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'

const INITIAL_RETRY_MS = 1000
const MAX_RETRY_MS = 30000

export interface MarketSocketHandlers {
  onEvent: (event: MarketListingEvent) => void
  onReconnect?: () => void
}

interface UseMarketListingSocketReturn {
  status: Ref<ConnectionStatus>
}

export function useMarketListingSocket(
  listingId: MaybeRefOrGetter<string | null | undefined>,
  handlers: MarketSocketHandlers,
): UseMarketListingSocketReturn {
  const status = ref<ConnectionStatus>('disconnected')

  let ws: WebSocket | null = null
  let retryMs = INITIAL_RETRY_MS
  let retryTimeout: ReturnType<typeof setTimeout> | null = null
  let disposed = false
  let droppedWhileActive = false

  function onMessage(event: MessageEvent) {
    const parsed = parseSocketJson<MarketListingEvent>(event.data)
    if (parsed) handlers.onEvent(parsed)
  }

  function scheduleReconnect(id: string) {
    if (disposed || retryTimeout) return
    status.value = 'reconnecting'
    retryTimeout = setTimeout(() => {
      retryTimeout = null
      if (!disposed && toValue(listingId) === id) connect(id)
    }, retryMs)
    retryMs = Math.min(retryMs * 2, MAX_RETRY_MS)
  }

  function connect(id: string) {
    if (ws) return
    try {
      ws = new WebSocket(`${wsOrigin()}/ws/market?listingId=${encodeURIComponent(id)}`)

      ws.addEventListener('open', () => {
        if (disposed) {
          ws?.close()
          return
        }
        status.value = 'connected'
        retryMs = INITIAL_RETRY_MS
        if (droppedWhileActive) {
          droppedWhileActive = false
          handlers.onReconnect?.()
        }
      })

      ws.addEventListener('message', onMessage)

      ws.addEventListener('close', () => {
        ws = null
        if (!disposed) {
          droppedWhileActive = true
          scheduleReconnect(id)
        }
      })

      ws.addEventListener('error', () => {
        ws?.close()
      })
    } catch {
      ws = null
      if (!disposed) scheduleReconnect(id)
    }
  }

  function teardown() {
    if (retryTimeout) {
      clearTimeout(retryTimeout)
      retryTimeout = null
    }
    if (ws) {
      ws.close()
      ws = null
    }
    retryMs = INITIAL_RETRY_MS
    droppedWhileActive = false
    status.value = 'disconnected'
  }

  watch(
    () => toValue(listingId),
    (id) => {
      teardown()
      disposed = !id
      if (id) connect(id)
    },
    { immediate: true },
  )

  onUnmounted(() => {
    disposed = true
    teardown()
  })

  return { status }
}
