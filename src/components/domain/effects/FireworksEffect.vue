<script setup lang="ts">
import type { Composition } from '@/types/api/items'
import type { TokenContext } from '@/utils/items'
import { computed } from 'vue'
import { asNumber, boxScale, hash01, type EffectMeasure } from './shared'

const props = defineProps<{
  composition: Composition
  ctx: TokenContext
  measure: EffectMeasure
}>()

const FW_COLORS = ['#ff5a5a', '#ffd75e', '#6ee7ff', '#8dff7a', '#c99bff', '#ff9c58']

interface FireworksConfig {
  count: number
  periodSecs: number
  sparks: number
  colors: string[]
  intensity: number
}

function readFireworks(c: Composition): FireworksConfig {
  const rawColors = Array.isArray(c.colors)
    ? c.colors.filter((v): v is string => typeof v === 'string')
    : []
  return {
    count: Math.max(1, Math.min(6, Math.round(asNumber(c.count) ?? 3))),
    periodSecs: Math.max(2.5, asNumber(c.periodSecs) ?? 5.6),
    sparks: Math.max(6, Math.min(20, Math.round(asNumber(c.sparks) ?? 12))),
    colors: rawColors.length > 0 ? rawColors : FW_COLORS,
    intensity: Math.max(0.3, Math.min(1.5, asNumber(c.intensity) ?? 1)),
  }
}

interface Firework {
  x: number
  y: number
  duration: number
  delay: number
  color: string
  rise: number
  trailLen: number
  flashSize: number
  sparks: Array<{ sx: number, sy: number }>
}

const fireworks = computed<Firework[]>(() => {
  const box = props.measure.box
  if (!box.w || !box.h) return []
  const cfg = readFireworks(props.composition)
  const minD = Math.min(box.w, box.h)
  const scale = boxScale(minD, 0.6)
  const stack = props.measure.stack
  const out: Firework[] = []
  for (let i = 0; i < cfg.count; i++) {
    const s = i + stack * 101
    const burstY = box.y + box.h * (0.04 + hash01(s * 5 + 4) * 0.22)
    const trailLen = (box.y + box.h - burstY) * 0.3
    const sparks: Array<{ sx: number, sy: number }> = []
    for (let k = 0; k < cfg.sparks; k++) {
      const ks = s * 37 + k
      const ang = (k / cfg.sparks) * Math.PI * 2 + (hash01(ks * 3 + 5) - 0.5) * 0.5
      const dist = minD * (0.10 + hash01(ks * 7 + 6) * 0.09) * cfg.intensity
      sparks.push({ sx: Math.cos(ang) * dist, sy: Math.sin(ang) * dist })
    }
    out.push({
      x: box.x + box.w * (0.16 + hash01(s * 3 + 3) * 0.68),
      y: burstY,
      duration: cfg.periodSecs * (0.92 + hash01(s * 7 + 1) * 0.22),
      delay: (i / cfg.count) * cfg.periodSecs + hash01(s * 11 + 2) * 1.2,
      color: cfg.colors[(i + stack * 2) % cfg.colors.length],
      rise: box.y + box.h - burstY - trailLen,
      trailLen,
      flashSize: 20 * scale,
      sparks,
    })
  }
  return out
})
</script>

<template>
  <div class="comp-fx-region">
    <div
      v-for="(fw, j) in fireworks"
      :key="j"
      class="comp-fx-fw"
      :style="{
        left: `${fw.x}px`,
        top: `${fw.y}px`,
        '--fwt': `${fw.duration.toFixed(2)}s`,
        '--fwd': `-${fw.delay.toFixed(2)}s`,
        '--fwc': fw.color,
        '--fwrise': `${fw.rise.toFixed(1)}px`,
        '--fwtlen': `${fw.trailLen.toFixed(1)}px`,
        '--fwsize': `${fw.flashSize.toFixed(1)}px`,
      }"
    >
      <span class="comp-fx-fw-trail"></span>
      <span class="comp-fx-fw-flash"></span>
      <span
        v-for="(sp, k) in fw.sparks"
        :key="k"
        class="comp-fx-fw-spark"
        :style="{ '--sx': `${sp.sx.toFixed(1)}px`, '--sy': `${sp.sy.toFixed(1)}px` }"
      ></span>
    </div>
  </div>
</template>

<style scoped>
.comp-fx-region {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: visible;
}

.comp-fx-fw {
  position: absolute;
  width: 0;
  height: 0;
}

.comp-fx-fw-trail {
  position: absolute;
  left: -1px;
  top: 0;
  width: 2px;
  height: var(--fwtlen, 30px);
  background: linear-gradient(to bottom,
    var(--fwc, #ffd75e) 0 10%,
    color-mix(in srgb, #aab2c4 55%, transparent) 34%,
    transparent 100%);
  border-radius: 1px;
  opacity: 0;
  animation: comp-fx-fw-trail var(--fwt, 5.6s) linear infinite;
  animation-delay: var(--fwd, 0s);
}

.comp-fx-fw-flash {
  position: absolute;
  left: calc(-0.5 * var(--fwsize, 20px));
  top: calc(-0.5 * var(--fwsize, 20px));
  width: var(--fwsize, 20px);
  height: var(--fwsize, 20px);
  border-radius: 50%;
  background: radial-gradient(circle, #fff 0 18%, var(--fwc, #ffd75e) 40%, transparent 70%);
  mix-blend-mode: var(--fx-blend, screen);
  opacity: 0;
  transform: scale(0.2);
  animation: comp-fx-fw-flash var(--fwt, 5.6s) ease-out infinite;
  animation-delay: var(--fwd, 0s);
}

.comp-fx-fw-spark {
  position: absolute;
  left: -1.5px;
  top: -1.5px;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: radial-gradient(circle at 45% 40%, #fff 0 25%, var(--fwc, #ffd75e) 70%);
  mix-blend-mode: var(--fx-blend, screen);
  opacity: 0;
  animation: comp-fx-fw-spark var(--fwt, 5.6s) ease-out infinite;
  animation-delay: var(--fwd, 0s);
}

@keyframes comp-fx-fw-trail {
  0%    { transform: translateY(var(--fwrise, 90px)); opacity: 0; }
  2%    { opacity: 0.9; }
  15%   { transform: translateY(0); opacity: 0.85; }
  17.5% { transform: translateY(0); opacity: 0; }
  100%  { transform: translateY(0); opacity: 0; }
}

@keyframes comp-fx-fw-flash {
  0%, 16% { opacity: 0; transform: scale(0.2); }
  19%     { opacity: 0.95; transform: scale(1); }
  27%     { opacity: 0; transform: scale(1.5); }
  100%    { opacity: 0; transform: scale(1.5); }
}

@keyframes comp-fx-fw-spark {
  0%, 17% { opacity: 0; transform: translate(0, 0); }
  19%     { opacity: 1; }
  42%     { opacity: 0.9; transform: translate(var(--sx, 0px), var(--sy, 0px)); }
  72%     { opacity: 0; transform: translate(var(--sx, 0px), calc(var(--sy, 0px) + 5px)); }
  100%    { opacity: 0; transform: translate(var(--sx, 0px), calc(var(--sy, 0px) + 5px)); }
}

@media (prefers-reduced-motion: reduce) {
  .comp-fx-fw-trail {
    animation: none;
    opacity: 0;
  }
  .comp-fx-fw-flash {
    animation: none;
    opacity: 0.35;
    transform: scale(1);
  }
  .comp-fx-fw-spark {
    animation: none;
    opacity: 0.55;
    transform: translate(var(--sx, 0px), var(--sy, 0px));
  }
}
</style>
