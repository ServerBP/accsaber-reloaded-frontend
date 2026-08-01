import { onBeforeUnmount, ref } from 'vue'

const RESYNC_NOTICE_MS = 6000

export function useNameSyncSetting() {
  const enabled = ref<boolean | null>(null)
  const saving = ref(false)
  const resyncQueued = ref(false)
  let resyncTimer: ReturnType<typeof setTimeout> | null = null

  async function fetch() {
    try {
      const { getMySyncSettings } = await import('@/api/users')
      const res = await getMySyncSettings()
      enabled.value = res['sync.name']
    } catch {
      enabled.value = null
    }
  }

  async function set(next: boolean) {
    if (saving.value || enabled.value === null || enabled.value === next) return
    saving.value = true
    const wasOff = enabled.value === false
    try {
      const { putMySyncSettings } = await import('@/api/users')
      await putMySyncSettings({ 'sync.name': next })
      enabled.value = next
      if (wasOff && enabled.value === true) {
        resyncQueued.value = true
        if (resyncTimer) clearTimeout(resyncTimer)
        resyncTimer = setTimeout(() => { resyncQueued.value = false }, RESYNC_NOTICE_MS)
      }
    } catch {
    } finally {
      saving.value = false
    }
  }

  function reset() {
    resyncQueued.value = false
    if (resyncTimer) clearTimeout(resyncTimer)
  }

  onBeforeUnmount(() => {
    if (resyncTimer) clearTimeout(resyncTimer)
  })

  return { enabled, saving, resyncQueued, fetch, set, reset }
}
