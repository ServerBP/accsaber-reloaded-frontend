import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import type { NotificationResponse } from '@/types/api/notifications'
import { isStaffSubdomain } from '@/utils/subdomain'
import { parseSocketJson, wsOrigin } from '@/utils/ws'
import { onScopeDispose, watch } from 'vue'

const INITIAL_RETRY_MS = 1000
const MAX_RETRY_MS = 30000
const CLOSE_UNAUTHORIZED = 4401
const CLOSE_FORBIDDEN = 4403

export function useNotificationSocket(): void {
  if (isStaffSubdomain) return

  const auth = useAuthStore()
  const store = useNotificationsStore()

  let ws: WebSocket | null = null
  let retryMs = INITIAL_RETRY_MS
  let retryTimeout: ReturnType<typeof setTimeout> | null = null
  let generation = 0
  let halted = false
  let refreshedOnce = false

  function scheduleReconnect() {
    if (retryTimeout || halted) return
    store.setDegraded(true)
    retryTimeout = setTimeout(() => {
      retryTimeout = null
      void connect()
    }, retryMs)
    retryMs = Math.min(retryMs * 2, MAX_RETRY_MS)
  }

  function halt() {
    halted = true
    store.setDegraded(true)
  }

  async function refreshAndReconnect() {
    refreshedOnce = true
    store.setDegraded(true)
    const myGeneration = generation
    if (auth.refreshTokenValue) await auth.refreshPlayerSession()
    if (myGeneration === generation && !halted) void connect()
  }

  async function connect() {
    if (ws || halted || !auth.isLoggedIn) return
    const myGeneration = generation
    if (auth.isPlayerTokenExpiringSoon && auth.refreshTokenValue) {
      await auth.refreshPlayerSession()
    }
    if (myGeneration !== generation || ws || halted) return
    const token = auth.accessToken
    if (!token) return

    const socket = new WebSocket(
      `${wsOrigin()}/ws/notifications?token=${encodeURIComponent(token)}`,
    )
    ws = socket

    socket.addEventListener('open', () => {
      if (socket !== ws) {
        socket.close()
        return
      }
      retryMs = INITIAL_RETRY_MS
      refreshedOnce = false
      store.setDegraded(false)
      void store.refresh()
    })

    socket.addEventListener('message', (event) => {
      if (socket !== ws) return
      const notification = parseSocketJson<NotificationResponse>(event.data)
      if (notification) store.ingest(notification)
    })

    socket.addEventListener('close', (event) => {
      if (socket !== ws) return
      ws = null
      if (halted || myGeneration !== generation) return
      if (event.code === CLOSE_FORBIDDEN) {
        halt()
        return
      }
      if (event.code === CLOSE_UNAUTHORIZED) {
        if (refreshedOnce) halt()
        else void refreshAndReconnect()
        return
      }
      scheduleReconnect()
    })

    socket.addEventListener('error', () => {
      socket.close()
    })
  }

  function teardown() {
    generation++
    if (retryTimeout) {
      clearTimeout(retryTimeout)
      retryTimeout = null
    }
    if (ws) {
      const socket = ws
      ws = null
      socket.close()
    }
    retryMs = INITIAL_RETRY_MS
    halted = false
    refreshedOnce = false
    store.setDegraded(false)
  }

  function reconcileOnFocus() {
    if (!document.hidden && auth.isLoggedIn) void store.fetchUnreadCount()
  }

  watch(
    () => auth.isLoggedIn,
    (loggedIn) => {
      teardown()
      if (loggedIn) void connect()
      else store.reset()
    },
    { immediate: true },
  )

  window.addEventListener('focus', reconcileOnFocus)
  document.addEventListener('visibilitychange', reconcileOnFocus)

  onScopeDispose(() => {
    window.removeEventListener('focus', reconcileOnFocus)
    document.removeEventListener('visibilitychange', reconcileOnFocus)
    teardown()
  })
}
