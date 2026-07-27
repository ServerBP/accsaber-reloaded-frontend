<script setup lang="ts">
import ItemPreview from '@/components/domain/ItemPreview.vue'
import { provideThemeBase } from '@/composables/useThemeBase'
import type { ItemResponse } from '@/types/api/items'
import { DEFAULT_AVATAR_MASK } from '@/utils/avatarBox'
import { readBorderShapeValue, readTitleValue } from '@/utils/items'
import { computed } from 'vue'

const props = defineProps<{
  item: ItemResponse
  width: number
  height: number
  base: 'dark' | 'light'
  flattenText?: boolean
}>()

const BORDER_WRAP_PCT = 60
const AVATAR_OF_WRAP = 0.886

provideThemeBase(computed(() => props.base))

const isBorder = computed(
  () =>
    props.item.typeKey === 'profile_border_shape'
    || props.item.typeKey === 'profile_border_color',
)

const shapeValue = computed(() =>
  props.item.typeKey === 'profile_border_shape' ? readBorderShapeValue(props.item.value) : null,
)

const avatarHoleMask = computed<string | null>(() => {
  if (!shapeValue.value) return null
  const span = BORDER_WRAP_PCT * AVATAR_OF_WRAP
  const inset = (100 - span) / 2
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">`
    + `<g transform="translate(${inset},${inset}) scale(${span / 100})">`
    + `<path d="${shapeValue.value.avatarMask ?? DEFAULT_AVATAR_MASK}" fill="#ffffff"/></g></svg>`
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`
})

const flatTextColor = computed<string | null>(() => {
  if (props.item.typeKey !== 'title') return null
  const state = readTitleValue(props.item.value)?.states?.[0]
  if (!state) return null
  const light = props.base === 'light'
  const gradient = (light ? state.lightGradient : undefined) ?? state.gradient
  if (gradient?.stops?.length) return gradient.stops[0].hex
  return (light ? state.lightColor : undefined) ?? state.color ?? null
})

const hostStyle = computed(() => {
  const style: Record<string, string> = {
    width: `${props.width}px`,
    height: `${props.height}px`,
  }
  if (avatarHoleMask.value) style['--avatar-hole'] = avatarHoleMask.value
  if (flatTextColor.value) style['--flat-text'] = flatTextColor.value
  return style
})
</script>

<template>
  <div
    class="icon-capture token-defaults"
    :class="{
      'icon-capture--hole': !!avatarHoleMask,
      'icon-capture--border': isBorder,
      'icon-capture--flat-text': flattenText && !!flatTextColor,
    }"
    :data-theme="base"
    :style="hostStyle"
    data-fx-static
    aria-hidden="true"
  >
    <ItemPreview :item="item" />
  </div>
</template>

<style scoped>
.icon-capture {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  font-family: var(--font-sans);
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}

.icon-capture :deep(.item-preview) {
  overflow: visible;
}

.icon-capture :deep(.item-preview__shape-avatar) {
  display: none;
}

.icon-capture :deep(.item-preview__title),
.icon-capture :deep(.title-renderer__text) {
  max-width: none;
  overflow: visible;
  text-overflow: clip;
}

.icon-capture--flat-text :deep(.title-renderer__text),
.icon-capture--flat-text :deep(.title-renderer__glint) {
  background-image: none !important;
  color: var(--flat-text) !important;
  -webkit-text-fill-color: var(--flat-text) !important;
}

.icon-capture--border :deep(.item-preview__shape-wrap),
.icon-capture--border :deep(.item-preview__color-swatch) {
  width: v-bind('`${BORDER_WRAP_PCT}%`');
}

.icon-capture--hole {
  mask-image: var(--avatar-hole), linear-gradient(#fff, #fff);
  -webkit-mask-image: var(--avatar-hole), linear-gradient(#fff, #fff);
  mask-size: 100% 100%, 100% 100%;
  -webkit-mask-size: 100% 100%, 100% 100%;
  mask-repeat: no-repeat, no-repeat;
  -webkit-mask-repeat: no-repeat, no-repeat;
  mask-composite: exclude;
  -webkit-mask-composite: xor;
}
</style>
