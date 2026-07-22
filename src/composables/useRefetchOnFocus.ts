import { onMounted, onUnmounted } from 'vue'

export function useRefetchOnFocus(refetch: () => void, intervalMs = 60000): void {
  let interval: ReturnType<typeof setInterval> | null = null

  function stop() {
    if (interval) {
      clearInterval(interval)
      interval = null
    }
  }

  function start() {
    stop()
    if (intervalMs > 0) interval = setInterval(refetch, intervalMs)
  }

  function onVisibility() {
    if (document.hidden) {
      stop()
    } else {
      refetch()
      start()
    }
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisibility)
    start()
  })

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', onVisibility)
    stop()
  })
}
