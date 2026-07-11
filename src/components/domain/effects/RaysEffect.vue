<script setup lang="ts">
import type { Composition } from '@/types/api/items'
import type { TokenContext } from '@/utils/items'
import { computed } from 'vue'
import { asNumber, asString, hash01, type EffectMeasure } from './shared'

const props = defineProps<{
  composition: Composition
  ctx: TokenContext
  measure: EffectMeasure
}>()

interface Ray {
  angle: number
  widthPct: number
  delay: number
  duration: number
  peak: number
}

const rays = computed<Ray[]>(() => {
  const c = props.composition
  const count = Math.max(3, Math.min(24, Math.round(asNumber(c.count) ?? 7)))
  const spread = Math.max(10, Math.min(180, asNumber(c.spreadDeg) ?? 100))
  const period = Math.max(0.6, (asNumber(c.flickerMs) ?? 3200) / 1000)
  const baseWidth = Math.max(0.5, asNumber(c.widthPct) ?? 5)
  const intensity = Math.max(0.1, Math.min(1, asNumber(c.intensity) ?? 0.8))
  const step = count > 1 ? spread / (count - 1) : 0
  const out: Ray[] = []
  for (let i = 0; i < count; i++) {
    out.push({
      angle: -spread / 2 + step * i,
      widthPct: baseWidth * (0.8 + hash01(i * 3 + 5) * 0.4),
      delay: hash01(i * 2 + 1) * period,
      duration: period + hash01(i * 2 + 7) * 1.4,
      peak: intensity * (0.7 + hash01(i * 3 + 2) * 0.3),
    })
  }
  return out
})

const color = computed(() => asString(props.composition.color) ?? '#fff4b8')
const heightPct = computed(() => Math.max(80, Math.min(260, asNumber(props.composition.lengthPct) ?? 150)))
const originYPct = computed(() => asNumber(props.composition.originYPct) ?? 12)
const blurPx = computed(() => Math.max(0, asNumber(props.composition.blurPx) ?? 1))
</script>

<template>
  <div class="comp-fx-region">
    <span
      v-for="(r, j) in rays"
      :key="j"
      class="comp-fx-ray"
      :style="{
        width: `${r.widthPct}%`,
        height: `${heightPct}%`,
        top: `${-originYPct}%`,
        transform: `translateX(-50%) rotate(${r.angle}deg)`,
        '--rcolor': color,
        '--rblur': `${blurPx}px`,
        '--rdur': `${r.duration}s`,
        '--rdelay': `${r.delay}s`,
        '--rpeak': r.peak,
      }"
    ></span>
  </div>
</template>

<style scoped>
.comp-fx-region {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.comp-fx-ray {
  position: absolute;
  left: 50%;
  transform-origin: top center;
  background: linear-gradient(to bottom,
    color-mix(in srgb, var(--rcolor) 88%, transparent) 0%,
    color-mix(in srgb, var(--rcolor) 34%, transparent) 42%,
    transparent 100%);
  -webkit-mask-image: linear-gradient(to right, transparent 0%, #000 50%, transparent 100%);
  mask-image: linear-gradient(to right, transparent 0%, #000 50%, transparent 100%);
  mix-blend-mode: var(--fx-blend, screen);
  filter: blur(var(--rblur, 1px));
  opacity: 0;
  animation: comp-fx-ray-shine var(--rdur, 3.2s) ease-in-out infinite;
  animation-delay: var(--rdelay, 0s);
}

@keyframes comp-fx-ray-shine {
  0%, 100% { opacity: 0; }
  50%      { opacity: var(--rpeak, 0.7); }
}

@media (prefers-reduced-motion: reduce) {
  .comp-fx-ray {
    animation: none;
    opacity: var(--rpeak, 0.6);
  }
}
</style>
