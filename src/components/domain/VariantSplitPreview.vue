<script setup lang="ts">
import ItemPreview from '@/components/domain/ItemPreview.vue'
import { useOverlayMeasure } from '@/composables/useOverlayMeasure'
import type { ItemResponse } from '@/types/api/items'
import type { ItemVariantPreview } from '@/utils/items'
import { computed, ref } from 'vue'

const props = defineProps<{
  item: ItemResponse
  variants: ItemVariantPreview[]
}>()

const SLANT_PCT = 14
const SEAM_PCT = 0.9

const measureRef = ref<HTMLElement | null>(null)
const { overlayBox, box } = useOverlayMeasure(measureRef, () => '.item-preview > *')

const contentLeft = computed(() => (overlayBox.value.w ? (box.value.x / overlayBox.value.w) * 100 : 0))
const contentRight = computed(() =>
  overlayBox.value.w ? ((box.value.x + box.value.w) / overlayBox.value.w) * 100 : 100,
)

interface VariantSlice extends ItemVariantPreview {
  clipPath: string
}

function boundaryX(k: number, count: number, cl: number, cr: number): { top: number; bottom: number } {
  if (k <= 0) return { top: 0, bottom: 0 }
  if (k >= count) return { top: 100, bottom: 100 }
  const center = cl + (k / count) * (cr - cl)
  return { top: center + SLANT_PCT / 2, bottom: center - SLANT_PCT / 2 }
}

const slices = computed<VariantSlice[]>(() => {
  const count = props.variants.length
  const cl = contentLeft.value
  const cr = contentRight.value
  return props.variants.map((variant, i) => {
    const left = boundaryX(i, count, cl, cr)
    const right = boundaryX(i + 1, count, cl, cr)
    const padLeft = i === 0 ? 0 : SEAM_PCT
    const padRight = i === count - 1 ? 0 : SEAM_PCT
    return {
      ...variant,
      clipPath: `polygon(${left.top + padLeft}% 0%, ${right.top - padRight}% 0%, ${right.bottom - padRight}% 100%, ${left.bottom + padLeft}% 100%)`,
    }
  })
})
</script>

<template>
  <span class="variant-split" role="img" :aria-label="`${item.name}, ${variants.length} variants`">
    <span ref="measureRef" class="variant-split__measure" aria-hidden="true"></span>
    <span
      v-for="s in slices"
      :key="s.key"
      class="variant-split__slice"
      :style="{ clipPath: s.clipPath }"
      :title="s.label"
    >
      <ItemPreview :item="s.item" />
    </span>
  </span>
</template>

<style scoped>
.variant-split {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
}

.variant-split__measure {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.variant-split__slice {
  position: absolute;
  inset: 0;
  display: block;
}
</style>
