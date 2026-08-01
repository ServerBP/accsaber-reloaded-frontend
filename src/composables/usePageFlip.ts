import { readonly, ref } from 'vue'

const STORAGE_KEY = 'accsaber:page-flipped'
const ROOT_CLASS = 'page-is-flipped'

const flipped = ref(false)
let initialized = false

function applyPageFlip(next: boolean): void {
  flipped.value = next

  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle(ROOT_CLASS, next)
  }
}

export function initializePageFlip(): void {
  if (initialized || typeof window === 'undefined') return
  initialized = true

  applyPageFlip(window.localStorage.getItem(STORAGE_KEY) === 'true')
}

export function usePageFlip() {
  initializePageFlip()

  function togglePageFlip(): void {
    const next = !flipped.value
    applyPageFlip(next)
    window.localStorage.setItem(STORAGE_KEY, String(next))
  }

  return {
    flipped: readonly(flipped),
    togglePageFlip,
  }
}
