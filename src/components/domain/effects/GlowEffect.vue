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

const anchorClass = computed(() => {
  const a = asString(props.composition.anchor)
  const anchor = a === 'top' || a === 'full' ? a : 'base'
  return `comp-fx-glow--${anchor}`
})

const hasCore = computed(() => !!asString(props.composition.coreColor))

function glowVars(core: boolean): Record<string, string> {
  const c = props.composition
  const size = (asNumber(c.sizePct) ?? 50) * (core ? 0.58 : 1)
  const flicker = (asNumber(c.flickerMs) ?? 2800) * (core ? 0.7 : 1)
  const glowColor = core
    ? asString(c.coreColor) ?? asString(c.color) ?? '#ff7a1e'
    : asString(c.color) ?? '#ff7a1e'
  return { '--glow-color': glowColor, '--gsize': `${size}%`, '--gd': `${flicker}ms` }
}
</script>

<template>
  <div class="comp-fx-region">
    <div class="comp-fx-glow" :class="anchorClass" :style="glowVars(false)"></div>
    <div v-if="hasCore" class="comp-fx-glow" :class="anchorClass" :style="glowVars(true)"></div>
  </div>
</template>

<style scoped>
.comp-fx-region {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.comp-fx-glow {
  position: absolute;
  left: 0;
  right: 0;
  height: var(--gsize, 50%);
  mix-blend-mode: var(--fx-blend, screen);
  animation: comp-fx-glow-flicker var(--gd, 2800ms) ease-in-out infinite;
}

.comp-fx-glow--base {
  bottom: 0;
  background: radial-gradient(76% 100% at 50% 100%,
    color-mix(in srgb, var(--glow-color) 52%, transparent) 0%,
    color-mix(in srgb, var(--glow-color) 28%, transparent) 34%,
    color-mix(in srgb, var(--glow-color) 8%, transparent) 58%,
    transparent 74%);
  -webkit-mask-image: linear-gradient(to top, transparent 0%, #000 6%, #000 100%);
  mask-image: linear-gradient(to top, transparent 0%, #000 6%, #000 100%);
}

.comp-fx-glow--top {
  top: 0;
  background: radial-gradient(76% 100% at 50% 0%,
    color-mix(in srgb, var(--glow-color) 52%, transparent) 0%,
    color-mix(in srgb, var(--glow-color) 28%, transparent) 34%,
    color-mix(in srgb, var(--glow-color) 8%, transparent) 58%,
    transparent 74%);
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, #000 6%, #000 100%);
  mask-image: linear-gradient(to bottom, transparent 0%, #000 6%, #000 100%);
}

.comp-fx-glow--full {
  inset: 0;
  height: auto;
  background: radial-gradient(62% 62% at 50% 50%,
    color-mix(in srgb, var(--glow-color) 40%, transparent) 0%,
    color-mix(in srgb, var(--glow-color) 16%, transparent) 46%,
    transparent 72%);
}

@keyframes comp-fx-glow-flicker {
  0%   { opacity: 0.85; }
  22%  { opacity: 1; }
  41%  { opacity: 0.72; }
  63%  { opacity: 0.96; }
  82%  { opacity: 0.8; }
  100% { opacity: 0.85; }
}

@media (prefers-reduced-motion: reduce) {
  .comp-fx-glow {
    animation: none;
  }
}
</style>
