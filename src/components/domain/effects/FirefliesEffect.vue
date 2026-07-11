<script setup lang="ts">
import type { Composition } from '@/types/api/items'
import type { TokenContext } from '@/utils/items'
import { computed } from 'vue'
import { asNumber, asString, boxScale, hash01, type EffectMeasure } from './shared'

const props = defineProps<{
  composition: Composition
  ctx: TokenContext
  measure: EffectMeasure
}>()

interface FirefliesConfig {
  count: number
  color: string
  sizeMinPx: number
  sizeMaxPx: number
  wanderSecs: number
  flickerSecs: number
  intensity: number
}

function readFireflies(c: Composition): FirefliesConfig {
  const sizeMin = Math.max(1, Math.min(8, asNumber(c.sizeMinPx) ?? 2))
  return {
    count: Math.max(4, Math.min(24, Math.round(asNumber(c.count) ?? 10))),
    color: asString(c.color) ?? '#d9f06a',
    sizeMinPx: sizeMin,
    sizeMaxPx: Math.max(sizeMin, Math.min(10, asNumber(c.sizeMaxPx) ?? 3.5)),
    wanderSecs: Math.max(3, asNumber(c.wanderSecs) ?? 9),
    flickerSecs: Math.max(1.2, asNumber(c.flickerSecs) ?? 3.2),
    intensity: Math.max(0.2, Math.min(1, asNumber(c.intensity) ?? 1)),
  }
}

interface Firefly {
  x: number
  y: number
  size: number
  wanderDur: number
  wanderDelay: number
  w1x: number
  w1y: number
  w2x: number
  w2y: number
  flickerDur: number
  flickerDelay: number
  peak: number
  color: string
}

const fireflies = computed<Firefly[]>(() => {
  const box = props.measure.box
  if (!box.w || !box.h) return []
  const cfg = readFireflies(props.composition)
  const minD = Math.min(box.w, box.h)
  const maxD = Math.max(box.w, box.h)
  const elongated = maxD / minD >= 1.5
  const scale = boxScale(minD)
  const countScale = boxScale(elongated ? maxD : minD)
  const stack = props.measure.stack
  const count = Math.round(cfg.count * countScale)
  const out: Firefly[] = []
  for (let i = 0; i < count; i++) {
    const s = i + stack * 101
    const amp = minD * (0.10 + hash01(s * 11 + 4) * 0.14)
    const a1 = hash01(s * 13 + 5) * Math.PI * 2
    const a2 = a1 + Math.PI * (0.5 + hash01(s * 17 + 6))
    out.push({
      x: box.x + box.w * (-0.05 + hash01(s * 3 + 2) * 1.1),
      y: box.y + box.h * (-0.06 + hash01(s * 5 + 3) * 1.12),
      size: (cfg.sizeMinPx + hash01(s * 7 + 1) * (cfg.sizeMaxPx - cfg.sizeMinPx)) * scale,
      wanderDur: cfg.wanderSecs * (0.8 + hash01(s * 19 + 7) * 0.5),
      wanderDelay: hash01(s * 23 + 8) * cfg.wanderSecs,
      w1x: Math.cos(a1) * amp,
      w1y: Math.sin(a1) * amp * 0.7,
      w2x: Math.cos(a2) * amp * 0.8,
      w2y: Math.sin(a2) * amp * 0.6,
      flickerDur: cfg.flickerSecs * (0.7 + hash01(s * 29 + 9) * 0.9),
      flickerDelay: hash01(s * 31 + 10) * cfg.flickerSecs * 1.5,
      peak: cfg.intensity * (0.75 + hash01(s * 37 + 11) * 0.25),
      color: cfg.color,
    })
  }
  return out
})
</script>

<template>
  <div class="comp-fx-region">
    <span
      v-for="(fly, j) in fireflies"
      :key="j"
      class="comp-fx-firefly"
      :style="{
        left: `${fly.x.toFixed(1)}px`,
        top: `${fly.y.toFixed(1)}px`,
        width: `${fly.size.toFixed(1)}px`,
        height: `${fly.size.toFixed(1)}px`,
        '--wdur': `${fly.wanderDur.toFixed(2)}s`,
        '--wdelay': `-${fly.wanderDelay.toFixed(2)}s`,
        '--f1x': `${fly.w1x.toFixed(1)}px`,
        '--f1y': `${fly.w1y.toFixed(1)}px`,
        '--f2x': `${fly.w2x.toFixed(1)}px`,
        '--f2y': `${fly.w2y.toFixed(1)}px`,
      }"
    >
      <span
        class="comp-fx-firefly-glow"
        :style="{
          '--ffc': fly.color,
          '--fdur': `${fly.flickerDur.toFixed(2)}s`,
          '--fdelay': `-${fly.flickerDelay.toFixed(2)}s`,
          '--fop': fly.peak.toFixed(2),
        }"
      ></span>
    </span>
  </div>
</template>

<style scoped>
.comp-fx-region {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: visible;
}

.comp-fx-firefly {
  position: absolute;
  animation: comp-fx-ff-wander var(--wdur, 9s) ease-in-out infinite;
  animation-delay: var(--wdelay, 0s);
}

.comp-fx-firefly-glow {
  position: absolute;
  inset: -100%;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 48%,
    #ffffff 0 16%,
    var(--ffc, #d9f06a) 46%,
    color-mix(in srgb, var(--ffc, #d9f06a) 45%, transparent) 62%,
    transparent 78%);
  opacity: 0;
  animation: comp-fx-ff-flicker var(--fdur, 3.2s) linear infinite;
  animation-delay: var(--fdelay, 0s);
}

@keyframes comp-fx-ff-wander {
  0%, 100% { transform: translate(0, 0); }
  33%      { transform: translate(var(--f1x, 10px), var(--f1y, -8px)); }
  66%      { transform: translate(var(--f2x, -8px), var(--f2y, 6px)); }
}

@keyframes comp-fx-ff-flicker {
  0%, 100% { opacity: 0; }
  5%   { opacity: var(--fop, 0.9); }
  13%  { opacity: calc(var(--fop, 0.9) * 0.8); }
  19%  { opacity: 0; }
  52%  { opacity: 0; }
  57%  { opacity: calc(var(--fop, 0.9) * 0.9); }
  68%  { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .comp-fx-firefly {
    animation: none;
  }
  .comp-fx-firefly-glow {
    animation: none;
    opacity: calc(var(--fop, 0.9) * 0.55);
  }
}
</style>
