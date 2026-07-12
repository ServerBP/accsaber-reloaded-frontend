import { onUnmounted, ref } from 'vue'

export function useNow(intervalMs = 60000) {
  const now = ref(Date.now())
  const id = setInterval(() => {
    now.value = Date.now()
  }, intervalMs)
  onUnmounted(() => clearInterval(id))
  return now
}
