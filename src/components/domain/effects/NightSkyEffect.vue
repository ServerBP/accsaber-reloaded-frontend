<script setup lang="ts">
import type { Composition } from '@/types/api/items'
import type { TokenContext } from '@/utils/items'
import { computed } from 'vue'
import { asNumber, asString, boxScale, hash01, type ContentBox, type EffectMeasure } from './shared'

const props = defineProps<{
  composition: Composition
  ctx: TokenContext
  measure: EffectMeasure
}>()

interface NightConfig {
  count: number
  sizePct: number
  driftMs: number
  sky: string
  starColor: string
  moonColor: string
  moon: boolean
  moonXPct: number
  moonYPct: number
  moonSizePct: number
  intensity: number
}

function isWide(box: ContentBox): boolean {
  return box.w > 0 && box.h > 0 && box.w / box.h >= 1.5
}

function readNight(c: Composition, box: ContentBox): NightConfig {
  const elongated = isWide(box)
  return {
    count: Math.max(4, Math.min(40, Math.round((asNumber(c.count) ?? 18) * (elongated ? 0.55 : 1)))),
    sizePct: elongated ? 100 : Math.max(20, Math.min(100, asNumber(c.sizePct) ?? 46)),
    driftMs: Math.max(3000, asNumber(c.driftMs) ?? 11000),
    sky: asString(c.sky) ?? '#161245',
    starColor: asString(c.starColor) ?? '#ded9ff',
    moonColor: asString(c.moonColor) ?? '#ebe4fa',
    moon: c.moon !== false,
    moonXPct: asNumber(c.moonXPct) ?? 74,
    moonYPct: asNumber(c.moonYPct) ?? 30,
    moonSizePct: (asNumber(c.moonSizePct) ?? 13) * (elongated ? 1.8 : 1),
    intensity: Math.max(0.2, Math.min(1, asNumber(c.intensity) ?? 0.85)),
  }
}

const cfg = computed(() => readNight(props.composition, props.measure.box))

const skyStyle = computed((): Record<string, string> => {
  const box = props.measure.box
  if (!box.w || !box.h) return { display: 'none' }
  const c = cfg.value
  return {
    left: `${box.x - box.w * 0.04}px`,
    top: `${box.y - box.h * 0.03}px`,
    width: `${box.w * 1.08}px`,
    height: `${box.h * (c.sizePct / 100)}px`,
    '--ndrift': `${c.driftMs / 1000}s`,
    '--nstar': c.starColor,
    '--nmoon': c.moonColor,
  }
})

const veil = computed(() => {
  const c = cfg.value
  const strongC = `color-mix(in srgb, ${c.sky} ${Math.round(c.intensity * 100)}%, transparent)`
  const midC = `color-mix(in srgb, ${c.sky} ${Math.round(c.intensity * 55)}%, transparent)`
  if (isWide(props.measure.box)) {
    return `linear-gradient(to bottom, transparent 0%, ${strongC} 28%, ${strongC} 72%, transparent 100%)`
  }
  return `linear-gradient(to bottom, transparent 0%, ${strongC} 14%, ${midC} 60%, transparent 100%)`
})

interface NightStar {
  x: number
  y: number
  size: number
  spark: boolean
  duration: number
  delay: number
}

const stars = computed<NightStar[]>(() => {
  const box = props.measure.box
  if (!box.w || !box.h) return []
  const c = cfg.value
  const minD = Math.min(box.w, box.h)
  const scale = boxScale(minD)
  const stack = props.measure.stack
  const count = Math.round(c.count * scale)
  const out: NightStar[] = []
  for (let i = 0; i < count; i++) {
    const s = i + stack * 101
    const spark = i % 6 === 3
    out.push({
      x: 3 + hash01(s * 3 + 2) * 94,
      y: 4 + hash01(s * 5 + 3) * 82,
      size: ((spark ? 3.2 : 1.6) + hash01(s * 7 + 1) * (spark ? 2.2 : 1.8)) * scale,
      spark,
      duration: 2.6 + hash01(s * 11 + 4) * 3.4,
      delay: hash01(s * 13 + 5) * 5,
    })
  }
  return out
})

const moons = computed<Array<{ x: number, y: number, sizePx: number }>>(() => {
  const box = props.measure.box
  if (!box.w || !box.h) return []
  if (props.measure.stack > 0) return []
  const c = cfg.value
  if (!c.moon) return []
  const minD = Math.min(box.w, box.h)
  return [{ x: c.moonXPct, y: c.moonYPct, sizePx: (c.moonSizePct / 100) * minD }]
})
</script>

<template>
  <div class="comp-fx-region">
    <div class="comp-fx-night-sky" :style="skyStyle">
      <div class="comp-fx-night-veil" :style="{ background: veil }"></div>
      <span
        v-for="(st, j) in stars"
        :key="j"
        class="comp-fx-night-star"
        :class="{ 'comp-fx-night-star--spark': st.spark }"
        :style="{
          left: `${st.x}%`,
          top: `${st.y}%`,
          width: `${st.size}px`,
          height: `${st.size}px`,
          '--ndur': `${st.duration}s`,
          '--ndelay': `-${st.delay}s`,
        }"
      ></span>
      <template v-for="(moon, j) in moons" :key="`moon-${j}`">
        <span
          class="comp-fx-night-moon-glow"
          :style="{
            width: `${moon.sizePx * 2.6}px`,
            height: `${moon.sizePx * 2.6}px`,
            left: `calc(${moon.x}% - ${moon.sizePx * 1.3}px)`,
            top: `calc(${moon.y}% - ${moon.sizePx * 1.3}px)`,
          }"
        ></span>
        <span
          class="comp-fx-night-moon"
          :style="{
            width: `${moon.sizePx}px`,
            height: `${moon.sizePx}px`,
            left: `calc(${moon.x}% - ${moon.sizePx / 2}px)`,
            top: `calc(${moon.y}% - ${moon.sizePx / 2}px)`,
          }"
        ></span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.comp-fx-region {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.comp-fx-night-sky {
  position: absolute;
  -webkit-mask-image: linear-gradient(to right, transparent 0%, #000 10%, #000 90%, transparent 100%);
  mask-image: linear-gradient(to right, transparent 0%, #000 10%, #000 90%, transparent 100%);
  animation: comp-fx-night-drift var(--ndrift, 11s) ease-in-out infinite;
}

.comp-fx-night-veil {
  position: absolute;
  inset: 0;
}

.comp-fx-night-star {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 45%, #fff 0%, var(--nstar, #ded9ff) 55%, transparent 100%);
  mix-blend-mode: var(--fx-blend, screen);
  animation: comp-fx-night-twinkle var(--ndur, 3s) ease-in-out infinite;
  animation-delay: var(--ndelay, 0s);
}

.comp-fx-night-star--spark {
  border-radius: 0;
  background: var(--nstar, #ded9ff);
  clip-path: polygon(50% 0%, 58% 42%, 100% 50%, 58% 58%, 50% 100%, 42% 58%, 0% 50%, 42% 42%);
}

.comp-fx-night-moon {
  position: absolute;
  border-radius: 50%;
  background:
    radial-gradient(circle at 34% 36%, rgba(10, 16, 40, 0.16) 0 11%, transparent 13%),
    radial-gradient(circle at 62% 62%, rgba(10, 16, 40, 0.12) 0 8%, transparent 10%),
    radial-gradient(circle at 42% 38%, #fff 0%, var(--nmoon, #ebe4fa) 55%, color-mix(in srgb, var(--nmoon, #ebe4fa) 80%, #6a7896) 100%);
  mix-blend-mode: var(--fx-blend, screen);
}

.comp-fx-night-moon-glow {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle,
    color-mix(in srgb, var(--nmoon, #ebe4fa) 34%, transparent) 0%,
    color-mix(in srgb, var(--nmoon, #ebe4fa) 12%, transparent) 55%,
    transparent 75%);
  mix-blend-mode: var(--fx-blend, screen);
  animation: comp-fx-night-breathe 6s ease-in-out infinite;
}

@keyframes comp-fx-night-drift {
  0%, 100% { transform: translate(0, 0); }
  25%      { transform: translate(-1.4%, 3%); }
  55%      { transform: translate(1%, -2%); }
  80%      { transform: translate(1.6%, 2%); }
}

@keyframes comp-fx-night-twinkle {
  0%, 100% { opacity: 0.25; transform: scale(0.8); }
  50%      { opacity: 1; transform: scale(1.1); }
}

@keyframes comp-fx-night-breathe {
  0%, 100% { opacity: 0.7; }
  50%      { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .comp-fx-night-sky,
  .comp-fx-night-moon-glow {
    animation: none;
  }
  .comp-fx-night-star {
    animation: none;
    opacity: 0.7;
  }
}
</style>
