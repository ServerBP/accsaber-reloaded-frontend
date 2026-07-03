import { useAuthStore } from '@/stores/auth'
import type { CampaignChatMessageResponse } from '@/types/api/campaigns'
import { hashString } from '@/utils/constants'
import { isUuid } from '@/utils/mapRoute'
import { onUnmounted, ref, watch, type Ref } from 'vue'

export type PresenceAction = 'move' | 'select' | 'drag' | 'connect' | 'place' | 'edit'
export type PresenceKind = 'node' | 'barrier' | 'text' | null

export interface PresencePeer {
  userId: string
  name: string
  avatarUrl: string
  color: string
  x: number | null
  y: number | null
  action: PresenceAction
  targetId: string | null
  kind: PresenceKind
  tray: string | null
  lastSeen: number
  lastCursorAt: number
}

interface PresenceWire {
  type: string
  actorUserId?: number | string | null
  actorName?: string | null
  actorAvatarUrl?: string | null
  targetId?: string | null
  x?: number | null
  y?: number | null
  field?: string | null
  members?: { userId: number | string; name?: string | null; avatarUrl?: string | null }[] | null
  message?: CampaignChatMessageResponse | null
}

const SEND_INTERVAL = 33
const INITIAL_RETRY_MS = 1000
const MAX_RETRY_MS = 30000
const HEARTBEAT_MS = 30000
const CURSOR_STALE_MS = 20000

const ACTIONS: PresenceAction[] = ['move', 'select', 'drag', 'connect', 'place', 'edit']

function presenceBase(): string {
  const wsBase: string = import.meta.env.VITE_WS_BASE ?? ''
  if (wsBase) {
    try {
      const u = new URL(wsBase)
      const proto = u.protocol === 'https:' || u.protocol === 'wss:' ? 'wss:' : 'ws:'
      return `${proto}//${u.host}`
    } catch {
      /* fall through to VITE_API_BASE */
    }
  }
  const apiBase: string = import.meta.env.VITE_API_BASE ?? ''
  try {
    const parsed = new URL(apiBase)
    const proto = parsed.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${parsed.host}`
  } catch {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${window.location.host}`
  }
}

export function colorForUser(userId: string): string {
  return `oklch(0.72 0.15 ${hashString(userId) % 360})`
}

function parseField(
  field: string | null | undefined,
): [PresenceAction, PresenceKind, string | null] {
  if (!field || field === 'off') return ['move', null, null]
  const [a, k, t] = field.split(':')
  const action = ACTIONS.includes(a as PresenceAction) ? (a as PresenceAction) : 'move'
  const kind = k === 'node' || k === 'barrier' || k === 'text' ? (k as PresenceKind) : null
  return [action, kind, t || null]
}

interface UseCampaignPresenceReturn {
  peers: Ref<PresencePeer[]>
  sendCursor: (
    x: number,
    y: number,
    action: PresenceAction,
    targetId: string | null,
    kind: PresenceKind,
    tray?: string | null,
  ) => void
  sendCursorOff: () => void
  sendChange: () => void
}

export function useCampaignPresence(
  campaignId: Ref<string | null | undefined>,
  active: Ref<boolean>,
  options: {
    onRemoteChange?: () => void
    onChat?: (message: CampaignChatMessageResponse) => void
  } = {},
): UseCampaignPresenceReturn {
  const auth = useAuthStore()
  const peers = ref<PresencePeer[]>([])
  let remoteChangeTimer: ReturnType<typeof setTimeout> | null = null

  const peerMap = new Map<string, PresencePeer>()
  let ws: WebSocket | null = null
  let disposed = false
  let connecting = false
  let retryMs = INITIAL_RETRY_MS
  let retryTimeout: ReturnType<typeof setTimeout> | null = null
  let heartbeat: ReturnType<typeof setInterval> | null = null
  let staleSweep: ReturnType<typeof setInterval> | null = null

  let pending: {
    x: number
    y: number
    action: PresenceAction
    targetId: string | null
    kind: PresenceKind
    tray: string | null
  } | null = null
  let sendTimer: ReturnType<typeof setTimeout> | null = null
  let lastSentAt = 0
  let lastSentKey = ''

  function selfId(): string | null {
    return auth.userId ?? null
  }

  function syncPeers() {
    peers.value = [...peerMap.values()]
  }

  function upsertPeer(id: string, name?: string | null, avatarUrl?: string | null): PresencePeer {
    let peer = peerMap.get(id)
    if (!peer) {
      peer = {
        userId: id,
        name: name ?? 'Collaborator',
        avatarUrl: avatarUrl ?? '',
        color: colorForUser(id),
        x: null,
        y: null,
        action: 'move',
        targetId: null,
        kind: null,
        tray: null,
        lastSeen: Date.now(),
        lastCursorAt: 0,
      }
      peerMap.set(id, peer)
    }
    if (name) peer.name = name
    if (avatarUrl) peer.avatarUrl = avatarUrl
    return peer
  }

  function onMessage(event: MessageEvent) {
    let msg: PresenceWire
    try {
      msg = JSON.parse(event.data)
    } catch {
      return
    }
    const type = msg.type
    if (!type) return

    if (type === 'presence_state') {
      const self = selfId()
      for (const m of msg.members ?? []) {
        const id = String(m.userId)
        if (id === self) continue
        upsertPeer(id, m.name, m.avatarUrl)
      }
      syncPeers()
      return
    }

    if (type === 'chat') {
      if (msg.message) options.onChat?.(msg.message)
      return
    }

    const actorId = msg.actorUserId != null ? String(msg.actorUserId) : null
    if (!actorId || actorId === selfId()) return

    if (type === 'change') {
      if (remoteChangeTimer) clearTimeout(remoteChangeTimer)
      remoteChangeTimer = setTimeout(() => {
        remoteChangeTimer = null
        options.onRemoteChange?.()
      }, 500)
      return
    }

    if (type === 'presence_leave') {
      peerMap.delete(actorId)
      syncPeers()
      return
    }

    const peer = upsertPeer(actorId, msg.actorName, msg.actorAvatarUrl)
    if (type !== 'presence_join') {
      const [action, kind, tray] = parseField(msg.field)
      peer.action = action
      peer.kind = kind
      peer.tray = tray
      peer.targetId = msg.targetId ?? null
      if (msg.x == null || msg.y == null || msg.field === 'off') {
        peer.x = null
        peer.y = null
      } else {
        peer.x = msg.x
        peer.y = msg.y
        peer.lastCursorAt = Date.now()
      }
    }
    peer.lastSeen = Date.now()
    syncPeers()
  }

  function flushCursor() {
    if (!pending || ws?.readyState !== WebSocket.OPEN) return
    const { x, y, action, targetId, kind, tray } = pending
    const field = `${action}:${kind ?? ''}:${tray ?? ''}`
    try {
      ws.send(JSON.stringify({ type: 'cursor', x, y, targetId: targetId ?? null, field }))
    } catch {
      return
    }
    lastSentAt = Date.now()
    lastSentKey = `${action}:${targetId ?? ''}`
    pending = null
  }

  function sendCursor(
    x: number,
    y: number,
    action: PresenceAction,
    targetId: string | null,
    kind: PresenceKind,
    tray: string | null = null,
  ) {
    if (ws?.readyState !== WebSocket.OPEN) return
    pending = { x, y, action, targetId, kind, tray }
    const key = `${action}:${targetId ?? ''}`
    if (key !== lastSentKey) {
      if (sendTimer) {
        clearTimeout(sendTimer)
        sendTimer = null
      }
      flushCursor()
      return
    }
    const elapsed = Date.now() - lastSentAt
    if (elapsed >= SEND_INTERVAL) {
      flushCursor()
    } else if (!sendTimer) {
      sendTimer = setTimeout(() => {
        sendTimer = null
        flushCursor()
      }, SEND_INTERVAL - elapsed)
    }
  }

  function sendCursorOff() {
    pending = null
    if (sendTimer) {
      clearTimeout(sendTimer)
      sendTimer = null
    }
    if (ws?.readyState !== WebSocket.OPEN) return
    lastSentKey = 'off'
    try {
      ws.send(JSON.stringify({ type: 'cursor', x: null, y: null, field: 'off' }))
    } catch {
      return
    }
  }

  function sendChange() {
    if (ws?.readyState !== WebSocket.OPEN) return
    try {
      ws.send(JSON.stringify({ type: 'change' }))
    } catch {
      return
    }
  }

  function stopTimers() {
    if (heartbeat) {
      clearInterval(heartbeat)
      heartbeat = null
    }
    if (staleSweep) {
      clearInterval(staleSweep)
      staleSweep = null
    }
  }

  function startTimers() {
    stopTimers()
    heartbeat = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        try {
          ws.send('ping')
        } catch {
          ws.close()
        }
      }
    }, HEARTBEAT_MS)
    staleSweep = setInterval(() => {
      const now = Date.now()
      let changed = false
      for (const peer of peerMap.values()) {
        if (peer.x !== null && now - peer.lastCursorAt > CURSOR_STALE_MS) {
          peer.x = null
          peer.y = null
          changed = true
        }
      }
      if (changed) syncPeers()
    }, 5000)
  }

  function scheduleReconnect() {
    if (disposed || retryTimeout || !active.value) return
    retryTimeout = setTimeout(() => {
      retryTimeout = null
      if (!disposed) void connect()
    }, retryMs)
    retryMs = Math.min(retryMs * 2, MAX_RETRY_MS)
  }

  async function connect() {
    if (ws || connecting || disposed) return
    const id = campaignId.value
    if (!id || !isUuid(id) || !active.value || !auth.hasPlayerSession) return
    connecting = true
    try {
      if (auth.isPlayerTokenExpiringSoon) {
        try {
          await auth.refreshPlayerSession()
        } catch {
          /* proceed with the current token; handshake will decide */
        }
      }
      const token = auth.accessToken
      if (!token || disposed || !active.value) return
      const url = `${presenceBase()}/ws/campaigns/presence?campaignId=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`
      ws = new WebSocket(url)

      ws.addEventListener('open', () => {
        if (disposed) {
          ws?.close()
          return
        }
        retryMs = INITIAL_RETRY_MS
        startTimers()
      })

      ws.addEventListener('message', onMessage)

      ws.addEventListener('close', () => {
        ws = null
        stopTimers()
        peerMap.clear()
        syncPeers()
        if (!disposed && active.value) scheduleReconnect()
      })

      ws.addEventListener('error', () => {
        ws?.close()
      })
    } catch {
      ws = null
      scheduleReconnect()
    } finally {
      connecting = false
    }
  }

  function disconnect() {
    disposed = true
    if (retryTimeout) {
      clearTimeout(retryTimeout)
      retryTimeout = null
    }
    if (sendTimer) {
      clearTimeout(sendTimer)
      sendTimer = null
    }
    if (remoteChangeTimer) {
      clearTimeout(remoteChangeTimer)
      remoteChangeTimer = null
    }
    stopTimers()
    if (ws) {
      ws.close()
      ws = null
    }
    peerMap.clear()
    syncPeers()
  }

  watch(
    [campaignId, active],
    () => {
      const id = campaignId.value
      const shouldConnect = active.value && !!id && isUuid(id) && auth.hasPlayerSession
      if (shouldConnect) {
        disposed = false
        void connect()
      } else {
        if (retryTimeout) {
          clearTimeout(retryTimeout)
          retryTimeout = null
        }
        stopTimers()
        if (ws) {
          ws.close()
          ws = null
        }
        peerMap.clear()
        syncPeers()
      }
    },
    { immediate: true },
  )

  onUnmounted(disconnect)

  return { peers, sendCursor, sendCursorOff, sendChange }
}
