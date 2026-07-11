<script setup lang="ts">
import ItemPreview from '@/components/domain/ItemPreview.vue'
import type { ItemResponse } from '@/types/api/items'
import type { ItemVariantPreview } from '@/utils/items'
import { computed } from 'vue'

const props = defineProps<{
  item: ItemResponse
  variants: ItemVariantPreview[]
}>()

const SLANT_PCT = 14
const SEAM_PCT = 0.9

interface VariantSlice extends ItemVariantPreview {
  clipPath: string
}

function boundaryX(k: number, count: number): { top: number; bottom: number } {
  if (k <= 0) return { top: 0, bottom: 0 }
  if (k >= count) return { top: 100, bottom: 100 }
  const center = (k / count) * 100
  return { top: center + SLANT_PCT / 2, bottom: center - SLANT_PCT / 2 }
}

const slices = computed<VariantSlice[]>(() => {
  const count = props.variants.length
  return props.variants.map((variant, i) => {
    const left = boundaryX(i, count)
    const right = boundaryX(i + 1, count)
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

.variant-split__slice {
  position: absolute;
  inset: 0;
  display: block;
}
</style>
