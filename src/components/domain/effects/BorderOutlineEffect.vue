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

const style = computed<Record<string, string>>(() => {
  const c = props.composition
  const color = asString(c.color) ?? 'currentColor'
  const widthPx = asNumber(c.widthPx) ?? 2
  const out: Record<string, string> = { border: `${widthPx}px solid ${color}` }
  if (c.glow) out.boxShadow = `0 0 8px ${color}, 0 0 16px ${color}`
  return out
})
</script>

<template>
  <div class="comp-border-outline" :style="style"></div>
</template>

<style scoped>
.comp-border-outline {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
}
</style>
