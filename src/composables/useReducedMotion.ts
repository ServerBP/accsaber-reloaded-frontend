import { onUnmounted, readonly, ref, type Ref } from 'vue'

const QUERY = '(prefers-reduced-motion: reduce)'

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(QUERY).matches
}

export function useReducedMotion(): Readonly<Ref<boolean>> {
  const reduced = ref(false)
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return readonly(reduced)
  }
  const media = window.matchMedia(QUERY)
  reduced.value = media.matches
  const handler = () => { reduced.value = media.matches }
  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', handler)
    onUnmounted(() => media.removeEventListener('change', handler))
  }
  return readonly(reduced)
}
