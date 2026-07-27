<script setup lang="ts">
import ItemPreview from '@/components/domain/ItemPreview.vue'
import type { ItemResponse } from '@/types/api/items'
import { DEFAULT_AVATAR_MASK } from '@/utils/avatarBox'
import { readBorderShapeValue } from '@/utils/items'
import { computed } from 'vue'

const props = defineProps<{
  item: ItemResponse
  width: number
  height: number
  base: 'dark' | 'light'
}>()

const AVATAR_INSET_PCT = 5.7
const AVATAR_SCALE = 0.886

const shapeValue = computed(() =>
  props.item.typeKey === 'profile_border_shape' ? readBorderShapeValue(props.item.value) : null,
)

const avatarHoleMask = computed<string | null>(() => {
  if (!shapeValue.value) return null
  const mask = shapeValue.value.avatarMask ?? DEFAULT_AVATAR_MASK
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">`
    + `<g transform="translate(${AVATAR_INSET_PCT},${AVATAR_INSET_PCT}) scale(${AVATAR_SCALE})">`
    + `<path d="${mask}" fill="#ffffff"/></g></svg>`
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`
})

const hostStyle = computed(() => {
  const style: Record<string, string> = {
    width: `${props.width}px`,
    height: `${props.height}px`,
  }
  if (avatarHoleMask.value) style['--avatar-hole'] = avatarHoleMask.value
  return style
})
</script>

<template>
  <div
    class="icon-capture token-defaults"
    :class="{ 'icon-capture--hole': !!avatarHoleMask }"
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

.icon-capture :deep(.item-preview__shape-avatar) {
  display: none;
}

.icon-capture--hole :deep(.item-preview__shape-wrap) {
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
