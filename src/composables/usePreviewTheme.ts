import { usePreviewStore } from '@/stores/preview'
import { useThemeStore } from '@/stores/theme'
import type { ItemResponse } from '@/types/api/items'
import { itemVariantPreviews, readThemeValue } from '@/utils/items'
import { isCreativesSubdomain } from '@/utils/subdomain'
import { watch } from 'vue'

function resolveThemeTokens(item: ItemResponse, variantKey: string | null): Record<string, string> | null {
  if (variantKey) {
    const match = itemVariantPreviews(item)?.find((p) => p.key === variantKey)
    if (match) return readThemeValue(match.item.value)?.tokens ?? null
  }
  return readThemeValue(item.value)?.tokens ?? null
}

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
    () => [preview.theme, preview.themeVariant] as const,
    ([themeItem, variantKey]) => {
      if (!isCreativesSubdomain) return
      const tokens = themeItem ? resolveThemeTokens(themeItem, variantKey) : null
      if (tokens) apply(tokens)
      else revert()
    },
    { immediate: true },
  )
}
