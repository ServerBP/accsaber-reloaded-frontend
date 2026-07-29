import { usePreviewStore } from '@/stores/preview'
import type { EquippedItemsResponse } from '@/types/api/items'
import {
  buildEffectLayers,
  pickAssetUrl,
  pickVideoOrAssetUrl,
  readBackgroundValue,
  readBorderColorValue,
  readBorderShapeValue,
  readThumbnailBackgroundValue,
  readTitleValue,
  resolveEquippedVariant,
} from '@/utils/items'
import { isCreativesSubdomain } from '@/utils/subdomain'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

export function useEquippedRenderProps(
  source: MaybeRefOrGetter<EquippedItemsResponse | null | undefined>,
  options?: { previewable?: boolean },
) {
  const preview = usePreviewStore()

  const equipped = computed<EquippedItemsResponse>(() => {
    const base = toValue(source) ?? {}
    if (options?.previewable && isCreativesSubdomain) {
      return { ...base, ...preview.overrides }
    }
    return base
  })

  const titleValue = computed(() =>
    resolveEquippedVariant(equipped.value.title, readTitleValue),
  )
  const borderShapeValue = computed(() =>
    resolveEquippedVariant(equipped.value.profile_border_shape, readBorderShapeValue),
  )
  const borderColorValue = computed(() =>
    resolveEquippedVariant(equipped.value.profile_border_color, readBorderColorValue),
  )
  const titleEffects = computed(() =>
    buildEffectLayers(equipped.value.title?.modifiers, equipped.value.title?.unusualEffect),
  )
  const borderEffects = computed(() => [
    ...buildEffectLayers(
      equipped.value.profile_border_shape?.modifiers,
      equipped.value.profile_border_shape?.unusualEffect,
    ),
    ...buildEffectLayers(
      equipped.value.profile_border_color?.modifiers,
      equipped.value.profile_border_color?.unusualEffect,
    ),
  ])

  const thumbnailValue = computed(() =>
    resolveEquippedVariant(equipped.value.profile_thumbnail_background, readThumbnailBackgroundValue),
  )

  const backgroundValue = computed(() =>
    readBackgroundValue(equipped.value.profile_background?.item.value),
  )
  const backgroundUrl = computed(() => pickVideoOrAssetUrl(backgroundValue.value?.asset))
  const backgroundIsVideo = computed(() => !!backgroundValue.value?.asset.video)
  const backgroundImageUrl = computed(() => pickAssetUrl(backgroundValue.value?.asset))
  const backgroundStyle = computed<Record<string, string> | undefined>(() => {
    const bg = backgroundValue.value
    if (!bg) return undefined
    const style: Record<string, string> = {}
    if (bg.opacity != null) style.opacity = String(bg.opacity)
    if (bg.blendMode) style.mixBlendMode = bg.blendMode
    return style
  })

  return {
    equipped,
    titleValue,
    borderShapeValue,
    borderColorValue,
    titleEffects,
    borderEffects,
    thumbnailValue,
    backgroundValue,
    backgroundUrl,
    backgroundIsVideo,
    backgroundImageUrl,
    backgroundStyle,
  }
}
