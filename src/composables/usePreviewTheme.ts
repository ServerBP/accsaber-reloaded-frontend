import { usePreviewStore } from '@/stores/preview'
import { useThemeStore } from '@/stores/theme'
import { readThemeValue } from '@/utils/items'
import { isCreativesSubdomain } from '@/utils/subdomain'
import { watch } from 'vue'

export function usePreviewTheme() {
  const preview = usePreviewStore()
  const themeStore = useThemeStore()

  let savedTokens: Record<string, string> | null = null
  let snapshotted = false

  function apply(tokens: Record<string, string>) {
    if (!snapshotted) {
      savedTokens = themeStore.activeTokens ? { ...themeStore.activeTokens } : null
      snapshotted = true
    }
    themeStore.previewThemeTokens(tokens)
  }

  function revert() {
    if (!snapshotted) return
    themeStore.previewThemeTokens(savedTokens)
    savedTokens = null
    snapshotted = false
  }

  watch(
    () => preview.theme,
    (themeItem) => {
      if (!isCreativesSubdomain) return
      const tokens = themeItem ? readThemeValue(themeItem.value)?.tokens ?? null : null
      if (tokens) apply(tokens)
      else revert()
    },
    { immediate: true },
  )
}
