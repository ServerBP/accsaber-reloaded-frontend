import { onUnmounted, ref, type Ref } from 'vue'

const now = ref(Date.now())
let interval: ReturnType<typeof setInterval> | null = null
let subscribers = 0

export function useSharedNow(): Readonly<Ref<number>> {
  subscribers++
  if (!interval) {
    now.value = Date.now()
    interval = setInterval(() => {
      now.value = Date.now()
    }, 1000)
  }
  onUnmounted(() => {
    subscribers--
    if (subscribers <= 0 && interval) {
      clearInterval(interval)
      interval = null
      subscribers = 0
    }
  })
  return now
}
