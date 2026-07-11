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

interface Particle {
  x: number
  y: number
  delay: number
  duration: number
  size: number
}

const particles = computed<Particle[]>(() => {
  const rate = asNumber(props.composition.ratePerSec) ?? 4
  const count = Math.max(3, Math.min(12, Math.round(rate * 2)))
  const out: Particle[] = []
  for (let i = 0; i < count; i++) {
    out.push({
      x: 10 + ((i * 73) % 80),
      y: 10 + ((i * 47) % 80),
      delay: (i * 0.37) % 2.4,
      duration: 1.8 + (i % 4) * 0.5,
      size: 3 + (i % 3),
    })
  }
  return out
})

const color = computed(() => asString(props.composition.color) ?? 'var(--accent, #ffffff)')
</script>

<template>
  <div class="comp-particles">
    <span
      v-for="(p, j) in particles"
      :key="j"
      class="comp-particle"
      :style="{
        left: `${p.x}%`,
        top: `${p.y}%`,
        width: `${p.size}px`,
        height: `${p.size}px`,
        background: color,
        animationDelay: `${p.delay}s`,
        animationDuration: `${p.duration}s`,
      }"
    ></span>
  </div>
</template>

<style scoped>
.comp-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.comp-particle {
  position: absolute;
  border-radius: 50%;
  opacity: 0;
  animation: comp-particle-float 2s ease-out infinite;
}

@keyframes comp-particle-float {
  0%   { transform: translateY(0) scale(0.4); opacity: 0; }
  20%  { opacity: 0.8; }
  100% { transform: translateY(-30px) scale(1); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .comp-particle {
    animation: none;
  }
}
</style>
