import { usePreviewStore } from '@/stores/preview'
import { useThemeStore } from '@/stores/theme'
import type { ItemResponse } from '@/types/api/items'
import { buildEffectLayers, itemVariantPreviews, readThemeValue, type EffectLayer } from '@/utils/items'
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
  let savedEffects: EffectLayer[] | null = null
  let snapshotted = false

  function apply(tokens: Record<string, string> | null, effects: EffectLayer[]) {
    if (!snapshotted) {
      savedTokens = themeStore.activeTokens ? { ...themeStore.activeTokens } : null
      savedEffects = themeStore.activeEffects ? [...themeStore.activeEffects] : null
      snapshotted = true
    }
    themeStore.previewThemeTokens(tokens ?? savedTokens, effects)
  }

  function revert() {
    if (!snapshotted) return
    themeStore.previewThemeTokens(savedTokens, savedEffects)
    savedTokens = null
    savedEffects = null
    snapshotted = false
  }

  watch(
    () => [preview.theme, preview.themeVariant, preview.themeEffect, preview.themeModifiers] as const,
    ([themeItem, variantKey, effect, modifiers]) => {
      if (!isCreativesSubdomain) return
      const tokens = themeItem ? resolveThemeTokens(themeItem, variantKey) : null
      const effects = buildEffectLayers(modifiers, effect)
      if (tokens || effects.length) apply(tokens, effects)
      else revert()
    },
    { immediate: true },
  )
}
