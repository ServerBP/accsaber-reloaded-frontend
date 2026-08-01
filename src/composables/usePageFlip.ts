import { readonly, ref } from 'vue'

const STORAGE_KEY = 'accsaber:page-flipped'
const ROOT_CLASS = 'page-is-flipped'

const flipped = ref(false)
let initialized = false

function isPageFlipAllowed(): boolean {
  if (typeof window === 'undefined') return false

  const hostname = window.location.hostname.toLowerCase()

  return hostname === 'accsaber.com'
}

function applyPageFlip(next: boolean): void {
  flipped.value = next

  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle(ROOT_CLASS, next)
  }
}

export function initializePageFlip(): void {
  if (initialized || typeof window === 'undefined') return
  initialized = true

  if (!isPageFlipAllowed()) {
    applyPageFlip(false)
    return
  }

  applyPageFlip(true)
}

export function usePageFlip() {
  initializePageFlip()

  function togglePageFlip(): void {
    if (!isPageFlipAllowed()) return

    const next = !flipped.value
    applyPageFlip(next)
    window.localStorage.setItem(STORAGE_KEY, String(next))
  }

  return {
    flipped: readonly(flipped),
    togglePageFlip,
  }
}