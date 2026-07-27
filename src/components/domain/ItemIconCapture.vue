<script setup lang="ts">
import BorderDecals from '@/components/domain/BorderDecals.vue'
import BorderOverlay from '@/components/domain/BorderOverlay.vue'
import ItemPreview from '@/components/domain/ItemPreview.vue'
import ProfileBorderRenderer from '@/components/domain/ProfileBorderRenderer.vue'
import type { BorderColorValue, BorderShapeValue, ItemResponse } from '@/types/api/items'
import { SUPPORTER_TIER_PALETTE } from '@/types/api/supporters'
import { readBorderColorValue, readBorderShapeValue } from '@/utils/items'
import { computed } from 'vue'

const props = defineProps<{
  item: ItemResponse
  width: number
  height: number
  base: 'dark' | 'light'
}>()

const RING_SHAPE: BorderShapeValue = {
  viewBox: '0 0 100 100',
  states: [
    {
      atMs: 0,
      paths: [
        {
          d: 'M10,4 L90,4 Q96,4 96,10 L96,90 Q96,96 90,96 L10,96 Q4,96 4,90 L4,10 Q4,4 10,4 Z',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 8,
          strokeLinejoin: 'round',
        },
      ],
    },
  ],
}

const typeKey = computed(() => props.item.typeKey)

const isShapeItem = computed(() => typeKey.value === 'profile_border_shape')
const isColorItem = computed(() => typeKey.value === 'profile_border_color')
const isBorder = computed(() => isShapeItem.value || isColorItem.value)

const shapeValue = computed<BorderShapeValue | null>(() =>
  isShapeItem.value ? readBorderShapeValue(props.item.value) : null,
)

const colorValue = computed<BorderColorValue | null>(() =>
  isColorItem.value ? readBorderColorValue(props.item.value) : null,
)

const shapePreviewColor = computed<BorderColorValue | null>(() => {
  if (shapeValue.value?.renderMode !== 'pixel') return null
  const tier = SUPPORTER_TIER_PALETTE.bronze
  return {
    states: [
      {
        atMs: 0,
        fill: {
          type: 'pixel_metal',
          shadow: tier.shadow,
          base: tier.base,
          highlight: tier.highlight,
        },
      },
    ],
  }
})

const renderShape = computed<BorderShapeValue | null>(() =>
  isColorItem.value ? RING_SHAPE : shapeValue.value,
)

const renderColor = computed<BorderColorValue | null>(() =>
  isColorItem.value ? colorValue.value : shapePreviewColor.value,
)

const decals = computed(() => shapeValue.value?.decals ?? [])
const overlay = computed(() =>
  shapeValue.value?.overlay?.enabled ? shapeValue.value.overlay : null,
)

const hostStyle = computed(() => ({
  width: `${props.width}px`,
  height: `${props.height}px`,
}))
</script>

<template>
  <div
    class="icon-capture token-defaults"
    :data-theme="base"
    :style="hostStyle"
    data-fx-static
    aria-hidden="true"
  >
    <div v-if="isBorder" class="icon-capture__border">
      <ProfileBorderRenderer :shape="renderShape" :color="renderColor" />
      <BorderDecals v-if="decals.length" class="icon-capture__layer" :decals="decals" />
      <BorderOverlay
        v-if="overlay"
        class="icon-capture__layer"
        :overlay="overlay"
        :color="renderColor"
      />
    </div>
    <ItemPreview v-else :item="item" />
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

.icon-capture__border {
  position: relative;
  width: 78%;
  aspect-ratio: 1 / 1;
  color: var(--text-secondary);
}

.icon-capture__layer {
  z-index: 3;
}
</style>
