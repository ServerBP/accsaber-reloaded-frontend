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

const SNOW_SPOKE = 'M12 12 L12 2.2 M12 5.4 L9.7 3.6 M12 5.4 L14.3 3.6 M12 8.4 L10.1 6.8 M12 8.4 L13.9 6.8'
const SNOW_ANGLES = [0, 60, 120, 180, 240, 300]

interface SnowConfig {
  count: number
  color: string
  trailColor: string
  sizeMinPx: number
  sizeMaxPx: number
  fallSecs: number
  spinSecs: number
  intensity: number
}

function readSnow(c: Composition): SnowConfig {
  const sizeMin = Math.max(4, Math.min(24, asNumber(c.sizeMinPx) ?? 8))
  return {
    count: Math.max(4, Math.min(24, Math.round(asNumber(c.count) ?? 10))),
    color: asString(c.color) ?? '#cfe3fb',
    trailColor: asString(c.trailColor) ?? '#9cd0ff',
    sizeMinPx: sizeMin,
    sizeMaxPx: Math.max(sizeMin, Math.min(28, asNumber(c.sizeMaxPx) ?? 15)),
    fallSecs: Math.max(2, asNumber(c.fallSecs) ?? 7),
    spinSecs: Math.max(1.5, asNumber(c.spinSecs) ?? 5),
    intensity: Math.max(0.2, Math.min(1, asNumber(c.intensity) ?? 0.9)),
  }
}

interface SnowFlake {
  x: number
  y: number
  size: number
  fallDist: number
  fallDur: number
  fallDelay: number
  opacity: number
  swayDur: number
  swayAmp: number
  spinDur: number
  reverse: boolean
  color: string
  trailA: string
  trailB: string
}

const flakes = computed<SnowFlake[]>(() => {
  const box = props.measure.box
  if (!box.w || !box.h) return []
  const cfg = readSnow(props.composition)
  const minD = Math.min(box.w, box.h)
  const scale = boxScale(minD)
  const stack = props.measure.stack
  const count = Math.round(cfg.count * scale)
  const trailA = `color-mix(in srgb, ${cfg.trailColor} 30%, transparent)`
  const trailB = `color-mix(in srgb, ${cfg.trailColor} 12%, transparent)`
  const out: SnowFlake[] = []
  for (let i = 0; i < count; i++) {
    const s = i + stack * 101
    const size = (cfg.sizeMinPx + hash01(s * 7 + 1) * (cfg.sizeMaxPx - cfg.sizeMinPx)) * scale
    const spawnY = box.y - size - hash01(s * 5 + 9) * box.h * 0.06
    out.push({
      x: box.x + hash01(s * 3 + 2) * (box.w - size),
      y: spawnY,
      size,
      fallDist: box.y + box.h - spawnY + size,
      fallDur: cfg.fallSecs * (0.75 + hash01(s * 11 + 3) * 0.6),
      fallDelay: hash01(s * 13 + 4) * cfg.fallSecs * 1.4,
      opacity: cfg.intensity * (0.6 + hash01(s * 17 + 5) * 0.4),
      swayDur: 2.4 + hash01(s * 19 + 6) * 2.2,
      swayAmp: 3 + hash01(s * 23 + 7) * 5,
      spinDur: cfg.spinSecs * (0.7 + hash01(s * 29 + 8) * 0.8),
      reverse: i % 2 === 1,
      color: cfg.color,
      trailA,
      trailB,
    })
  }
  return out
})
</script>

<template>
  <div class="comp-fx-region">
    <span
      v-for="(fl, j) in flakes"
      :key="j"
      class="comp-fx-snow"
      :style="{
        left: `${fl.x}px`,
        top: `${fl.y}px`,
        width: `${fl.size}px`,
        height: `${fl.size}px`,
        '--fdur': `${fl.fallDur}s`,
        '--fdelay': `-${fl.fallDelay}s`,
        '--fdist': `${fl.fallDist.toFixed(1)}px`,
        '--fop': fl.opacity.toFixed(2),
      }"
    >
      <span
        class="comp-fx-snow-sway"
        :style="{ '--sdur': `${fl.swayDur}s`, '--samp': `${fl.swayAmp.toFixed(1)}px` }"
      >
        <span
          class="comp-fx-snow-trail"
          :style="{ background: `linear-gradient(to top, ${fl.trailA} 0%, ${fl.trailB} 45%, transparent 100%)` }"
        ></span>
        <span
          class="comp-fx-snow-spin"
          :style="{ '--rdur': `${fl.spinDur}s`, '--rdir': fl.reverse ? 'reverse' : 'normal' }"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <g v-for="a in SNOW_ANGLES" :key="a" :transform="`rotate(${a} 12 12)`">
              <path
                :d="SNOW_SPOKE"
                fill="none"
                :stroke="fl.color"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </g>
          </svg>
        </span>
      </span>
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

.comp-fx-snow {
  position: absolute;
  opacity: 0;
  animation: comp-fx-snow-fall var(--fdur, 7s) linear infinite;
  animation-delay: var(--fdelay, 0s);
}

.comp-fx-snow-sway {
  position: absolute;
  inset: 0;
  animation: comp-fx-snow-sway var(--sdur, 3s) ease-in-out infinite alternate;
}

.comp-fx-snow-spin {
  position: absolute;
  inset: 0;
  animation: comp-fx-snow-spin var(--rdur, 5s) linear infinite;
  animation-direction: var(--rdir, normal);
}

.comp-fx-snow-spin svg {
  display: block;
  width: 100%;
  height: 100%;
}

.comp-fx-snow-trail {
  position: absolute;
  left: 50%;
  bottom: 72%;
  width: 30%;
  height: 230%;
  transform: translateX(-50%);
  filter: blur(2px);
  border-radius: 40%;
}

@keyframes comp-fx-snow-fall {
  0%   { transform: translateY(0); opacity: 0; }
  7%   { opacity: var(--fop, 0.8); }
  82%  { opacity: var(--fop, 0.8); }
  100% { transform: translateY(var(--fdist, 140px)); opacity: 0; }
}

@keyframes comp-fx-snow-sway {
  from { transform: translateX(calc(-1 * var(--samp, 4px))); }
  to   { transform: translateX(var(--samp, 4px)); }
}

@keyframes comp-fx-snow-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .comp-fx-snow,
  .comp-fx-snow-sway,
  .comp-fx-snow-spin {
    animation: none;
  }
  .comp-fx-snow {
    opacity: calc(var(--fop, 0.8) * 0.7);
    transform: translateY(calc(var(--fdist, 140px) * 0.45));
  }
}
</style>
