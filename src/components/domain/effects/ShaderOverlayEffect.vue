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

const PASTEL_RAINBOW = [
  '#ffb3d9',
  '#ffd1a8',
  '#fff2a8',
  '#b8f5c9',
  '#b3e1ff',
  '#d4baff',
]

interface Sparkle {
  x: number
  y: number
  size: number
  color: string
  delay: number
  duration: number
}

const sparkles = computed<Sparkle[]>(() => {
  const c = props.composition
  const density = Math.max(0.4, Math.min(1.6, asNumber(c.density) ?? 1))
  const count = Math.round(8 * density)
  const speedHz = asNumber(c.speedHz) ?? 0.6
  const baseDuration = 1 / Math.max(speedHz, 0.05)
  const out: Sparkle[] = []
  for (let i = 0; i < count; i++) {
    out.push({
      x: 8 + ((i * 53) % 84),
      y: 8 + ((i * 89) % 84),
      size: 5 + ((i * 3) % 4),
      color: PASTEL_RAINBOW[i % PASTEL_RAINBOW.length],
      delay: (i * 0.31) % baseDuration,
      duration: baseDuration + (i % 3) * 0.4,
    })
  }
  return out
})
</script>

<template>
  <div class="comp-sparkles" aria-hidden="true">
    <span
      v-for="(s, j) in sparkles"
      :key="j"
      class="comp-sparkle"
      :style="{
        left: `${s.x}%`,
        top: `${s.y}%`,
        width: `${s.size}px`,
        height: `${s.size}px`,
        background: s.color,
        animationDelay: `${s.delay}s`,
        animationDuration: `${s.duration}s`,
      }"
    ></span>
  </div>
</template>

<style scoped>
.comp-sparkles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.comp-sparkle {
  position: absolute;
  transform: translate(-50%, -50%) scale(0);
  border-radius: 1px;
  clip-path: polygon(
    50% 0%, 58% 42%, 100% 50%, 58% 58%,
    50% 100%, 42% 58%, 0% 50%, 42% 42%
  );
  opacity: 0;
  animation: comp-sparkle-twinkle 2.2s ease-in-out infinite;
}

@keyframes comp-sparkle-twinkle {
  0%, 100% { transform: translate(-50%, -50%) scale(0) rotate(0deg); opacity: 0; }
  40%      { transform: translate(-50%, -50%) scale(1) rotate(45deg); opacity: 1; }
  70%      { transform: translate(-50%, -50%) scale(0.6) rotate(90deg); opacity: 0.6; }
}

@media (prefers-reduced-motion: reduce) {
  .comp-sparkle {
    animation: none;
  }
}
</style>
