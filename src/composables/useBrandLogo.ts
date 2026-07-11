import logoUrl from '@/assets/logo.png'
import retroLogoUrl from '@/assets/retro-logo.png'
import { useThemeStore } from '@/stores/theme'
import { computed, watch, type ComputedRef } from 'vue'

const LOGO_REGISTRY: Record<string, string> = {
  acc_retro: retroLogoUrl,
}

export function useBrandLogo(): ComputedRef<string> {
  const themeStore = useThemeStore()
  return computed(() => {
    const key = themeStore.activeTokens?.['fx-logo']
    return (key && LOGO_REGISTRY[key]) || logoUrl
  })
}

export function useBrandFavicon(): void {
  const themeStore = useThemeStore()
  watch(
    () => themeStore.activeTokens?.['fx-logo'],
    (key) => {
      const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
      if (!link) return
      if (!link.dataset.defaultHref) link.dataset.defaultHref = link.href
      link.href = (key && LOGO_REGISTRY[key]) || link.dataset.defaultHref
    },
    { immediate: true },
  )
}
