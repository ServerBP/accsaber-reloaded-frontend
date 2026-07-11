<script setup lang="ts">
import type { Composition } from '@/types/api/items'
import type { TokenContext } from '@/utils/items'
import { computed } from 'vue'
import { asNumber, asString, type EffectMeasure } from './shared'

const props = defineProps<{
  composition: Composition
  ctx: TokenContext
  measure: EffectMeasure
}>()

const FILTER_CSS: Record<string, (amount: number) => string> = {
  sepia: (a) => `sepia(${a})`,
  saturate: (a) => `saturate(${a})`,
  desaturate: (a) => `saturate(${1 - a})`,
  noise_overlay: () => '',
}

const style = computed<Record<string, string>>(() => {
  const c = props.composition
  const filterType = asString(c.filterType) ?? ''
  const amount = asNumber(c.amount) ?? 1
  const fn = FILTER_CSS[filterType]
  const out: Record<string, string> = {}
  if (fn) {
    const expr = fn(amount)
    if (expr) {
      out.backdropFilter = expr
      out.webkitBackdropFilter = expr
    }
  }
  if (filterType === 'noise_overlay') {
    out.background = `url("data:image/svg+xml;utf8,${encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2"/></filter><rect width="80" height="80" filter="url(#n)" opacity="0.3"/></svg>',
    )}")`
    out.opacity = String(amount)
    out.mixBlendMode = 'overlay'
  }
  return out
})
</script>

<template>
  <div class="comp-filter" :style="style"></div>
</template>

<style scoped>
.comp-filter {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
</style>
