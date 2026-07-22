import { defineStore } from 'pinia'
import { ref } from 'vue'

export type OfflineReason = 'backend' | 'network'

const PROBE_PATH = '/categories'
const PROBE_TIMEOUT_MS = 6000
const RETRY_STEPS_MS = [5000, 8000, 13000, 21000, 30000]
const RELOAD_DELAY_MS = 700

const forced =
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('force-offline')

export const useBackendStatusStore = defineStore('backendStatus', () => {
  const offline = ref(false)
  const recovering = ref(false)
  const reason = ref<OfflineReason>('backend')
  const checking = ref(false)
  const nextProbeAt = ref<number | null>(null)
  const lastCheckedAt = ref<number | null>(null)

  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let attempt = 0
  let verifying = false

  function currentReason(): OfflineReason {
    return typeof navigator !== 'undefined' && !navigator.onLine ? 'network' : 'backend'
  }

  async function probe(): Promise<boolean> {
    if (forced) {
      lastCheckedAt.value = Date.now()
      return false
    }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE}${PROBE_PATH}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      return res.ok
    } catch {
      return false
    } finally {
      clearTimeout(timeout)
      lastCheckedAt.value = Date.now()
    }
  }

  function clearRetry() {
    if (retryTimer !== null) clearTimeout(retryTimer)
    retryTimer = null
    nextProbeAt.value = null
  }

  function scheduleRetry() {
    clearRetry()
    const delay = RETRY_STEPS_MS[Math.min(attempt, RETRY_STEPS_MS.length - 1)]
    attempt += 1
    nextProbeAt.value = Date.now() + delay
    retryTimer = setTimeout(() => void runProbe(), delay)
  }

  async function runProbe(): Promise<void> {
    if (checking.value || recovering.value) return
    checking.value = true
    const ok = await probe()
    checking.value = false
    if (recovering.value) return
    if (ok) {
      beginRecovery()
    } else {
      reason.value = currentReason()
      scheduleRetry()
    }
  }

  function beginRecovery() {
    if (recovering.value) return
    recovering.value = true
    clearRetry()
    window.removeEventListener('online', onBrowserOnline)
    setTimeout(() => window.location.reload(), RELOAD_DELAY_MS)
  }

  function onBrowserOnline() {
    void checkNow()
  }

  function enterOffline() {
    if (offline.value || recovering.value) return
    offline.value = true
    reason.value = currentReason()
    attempt = 0
    scheduleRetry()
    window.addEventListener('online', onBrowserOnline)
  }

  function reportUnreachable(): void {
    if (forced || offline.value || recovering.value || verifying) return
    verifying = true
    void probe().then((ok) => {
      verifying = false
      if (!ok) enterOffline()
    })
  }

  function reportReachable(): void {
    if (forced) return
    if (offline.value) beginRecovery()
  }

  async function checkNow(): Promise<void> {
    if (!offline.value) return
    clearRetry()
    await runProbe()
  }

  if (forced) enterOffline()

  return {
    offline,
    recovering,
    reason,
    checking,
    nextProbeAt,
    lastCheckedAt,
    reportUnreachable,
    reportReachable,
    checkNow,
  }
})
