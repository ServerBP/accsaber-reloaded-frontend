<script setup lang="ts">
import type { Composition } from '@/types/api/items'
import type { TokenContext } from '@/utils/items'
import { computed } from 'vue'
import { asNumber, hash01, type EffectMeasure } from './shared'

const props = defineProps<{
  composition: Composition
  ctx: TokenContext
  measure: EffectMeasure
}>()

const box = computed(() => props.measure.box)
const overlayBox = computed(() => props.measure.overlayBox)

interface AuroraConfig {
  count: number
  hueBase: number
  innerPct: number
  lengthPct: number
  widthPct: number
  blurPx: number
  shimmerMs: number
  intensity: number
  underline: boolean
}

function readAurora(c: Composition): AuroraConfig {
  return {
    underline: c.underline !== false,
    count: Math.max(6, Math.min(28, Math.round(asNumber(c.count) ?? 16))),
    hueBase: asNumber(c.hueBase) ?? 190,
    innerPct: Math.max(0, Math.min(45, asNumber(c.innerPct) ?? 26)),
    lengthPct: Math.max(10, Math.min(60, asNumber(c.lengthPct) ?? 30)),
    widthPct: Math.max(2, Math.min(20, asNumber(c.widthPct) ?? 8)),
    blurPx: Math.max(0, asNumber(c.blurPx) ?? 3.5),
    shimmerMs: Math.max(800, asNumber(c.shimmerMs) ?? 3400),
    intensity: Math.max(0.2, Math.min(1, asNumber(c.intensity) ?? 1)),
  }
}

function auroraRadius(cfg: AuroraConfig, b: { w: number, h: number }): number {
  const minD = Math.min(b.w, b.h)
  const maxD = Math.max(b.w, b.h)
  const radius = (cfg.innerPct / 100) * minD
  return maxD / minD < 1.5 ? Math.min(radius * 1.45, minD * 0.48) : radius
}

function stadiumPoint(sFrac: number, w: number, h: number, radius: number): { x: number, y: number, phi: number } {
  const horiz = w >= h
  const long = horiz ? w : h
  const short = horiz ? h : w
  const halfL = Math.max(0, (long - short) / 2)
  const flat = 2 * halfL
  const perimeter = 2 * flat + 2 * Math.PI * radius
  const s = sFrac * perimeter
  let x: number
  let y: number
  let phi: number
  if (s < flat) {
    x = -halfL + s
    y = -radius
    phi = 0
  } else if (s < flat + Math.PI * radius) {
    const t = (s - flat) / radius
    x = halfL + radius * Math.sin(t)
    y = -radius * Math.cos(t)
    phi = (t * 180) / Math.PI
  } else if (s < 2 * flat + Math.PI * radius) {
    x = halfL - (s - flat - Math.PI * radius)
    y = radius
    phi = 180
  } else {
    const t = (s - 2 * flat - Math.PI * radius) / radius
    x = -halfL - radius * Math.sin(t)
    y = radius * Math.cos(t)
    phi = 180 + (t * 180) / Math.PI
  }
  if (!horiz) {
    const tx = x
    x = y
    y = tx
    phi -= 90
  }
  return { x: w / 2 + x, y: h / 2 + y, phi }
}

function bandPoint(sFrac: number, w: number, h: number, radius: number): { x: number, y: number, phi: number } {
  const horiz = w >= h
  const long = horiz ? w : h
  const ext = Math.min(long * 0.12, 24)
  const span = long + 2 * ext
  const pos = -ext + sFrac * span
  const lean = ((pos - long / 2) / (long / 2 + ext)) * 12
  if (horiz) {
    return { x: pos, y: h / 2 - radius, phi: lean }
  }
  return { x: w / 2 - radius, y: pos, phi: -90 + lean }
}

interface AuroraLine {
  x: number
  y: number
  w: number
  h: number
  grad: string
  peak: number
  duration: number
  delay: number
}

interface AuroraSpike {
  x: number
  y: number
  angle: number
  widthPx: number
  heightPx: number
  grad: string
  peak: number
  duration: number
  delay: number
  blurPx: number
}

function auroraSpike(cfg: AuroraConfig, stack: number, i: number, petal: boolean, count: number, b: { w: number, h: number }): AuroraSpike {
  const minD = Math.min(b.w, b.h)
  const maxD = Math.max(b.w, b.h)
  const lenBasis = minD + 0.2 * (maxD - minD)
  const radius = auroraRadius(cfg, b)
  const blurScale = Math.max(0.8, Math.min(1, lenBasis / 140))
  const s = i + stack * 101 + (petal ? 57 : 0)
  const step = 1 / count
  const sFrac = (((i + 0.5) * step
    + stack * step * 0.5
    + (petal ? step * 0.35 : 0)
    + (hash01(s * 3 + 1) - 0.5) * step * 0.8) + 1) % 1
  const pt = maxD / minD >= 1.5
    ? bandPoint(sFrac, b.w, b.h, radius)
    : stadiumPoint(sFrac, b.w, b.h, radius)
  const hue = (cfg.hueBase + i * 137.5 + stack * 61 + (petal ? 200 : 0)) % 360
  const isWhite = !petal && i % 5 === 2
  const sat = isWhite ? 30 : 95
  const lit = isWhite ? 88 : 64
  let len = (cfg.lengthPct / 100) * lenBasis * (0.7 + hash01(s * 7 + 3) * 0.35) * (1 + stack * 0.32)
  let width = (cfg.widthPct / 100) * lenBasis * (0.9 + hash01(s * 11 + 5) * 0.5)
  let blur = cfg.blurPx * blurScale * 1.3
  let peak = cfg.intensity * (0.5 + hash01(s * 13 + 7) * 0.25)
  if (petal) {
    len = Math.max(len * 0.6, Math.min(12, minD * 0.45))
    width *= 3.2
    blur *= 2.2
    peak *= 0.75
  }
  const hs = `${hue.toFixed(0)} ${sat}% ${lit}%`
  const hot = `hsl(${hue.toFixed(0)} ${Math.max(25, sat - 45)}% ${Math.min(95, lit + 26)}% / 0.95)`
  const grad = `linear-gradient(to top, transparent 0%, ${hot} 10%, hsl(${hs} / 0.9) 26%, hsl(${hs} / 0.55) 52%, hsl(${hs} / 0.25) 76%, transparent 100%)`
  return {
    x: pt.x,
    y: pt.y,
    angle: pt.phi + (hash01(s * 23 + 13) - 0.5) * 8,
    widthPx: width,
    heightPx: len,
    grad,
    peak,
    duration: cfg.shimmerMs / 1000 + hash01(s * 17 + 9) * 1.8,
    delay: hash01(s * 19 + 11) * (cfg.shimmerMs / 1000),
    blurPx: blur,
  }
}

const spikes = computed<AuroraSpike[]>(() => {
  const b = box.value
  if (!b.w || !b.h) return []
  const cfg = readAurora(props.composition)
  const stack = props.measure.stack
  const minD = Math.min(b.w, b.h)
  const radius = auroraRadius(cfg, b)
  const halfL = (Math.max(b.w, b.h) - minD) / 2
  const perimeter = 4 * halfL + 2 * Math.PI * radius
  const ratio = radius > 0 ? perimeter / (2 * Math.PI * radius) : 1
  const elongated = Math.max(b.w, b.h) / minD >= 1.5
  const count = Math.round(cfg.count * Math.max(1, Math.min(1.6, ratio)) * (elongated ? 0.55 : 1))
  const out: AuroraSpike[] = []
  for (let i = 0; i < count; i++) out.push(auroraSpike(cfg, stack, i, false, count, b))
  const petals = Math.round(count * 1.4)
  for (let i = 0; i < petals; i++) out.push(auroraSpike(cfg, stack, i, true, petals, b))
  return out
})

const lines = computed<AuroraLine[]>(() => {
  const b = box.value
  if (!b.w || !b.h) return []
  if (b.w / b.h < 1.5) return []
  const cfg = readAurora(props.composition)
  if (!cfg.underline) return []
  const radius = auroraRadius(cfg, b)
  const ext = Math.min(b.w * 0.12, 24)
  const height = Math.max(2, Math.min(b.w, b.h) * 0.09)
  const hues: string[] = []
  for (let i = 0; i < 5; i++) {
    hues.push(`hsl(${((cfg.hueBase + i * 137.5) % 360).toFixed(0)} 95% 64% / 0.85)`)
  }
  const grad = `linear-gradient(90deg, transparent 0%, ${hues[0]} 10%, ${hues[1]} 28%, ${hues[2]} 46%, ${hues[3]} 64%, ${hues[4]} 82%, transparent 100%)`
  const stack = props.measure.stack
  return [{
    x: b.x - ext,
    y: b.y + b.h / 2 + radius - height / 2,
    w: b.w + 2 * ext,
    h: height,
    grad,
    peak: 0.75 * cfg.intensity,
    duration: cfg.shimmerMs / 1000 + 0.9,
    delay: hash01(41 + stack * 101) * (cfg.shimmerMs / 1000),
  }]
})
</script>

<template>
  <div class="comp-fx-region comp-fx-region--bleed">
    <span
      v-for="(sp, j) in spikes"
      :key="j"
      class="comp-fx-aurora"
      :style="{
        left: `${box.x + sp.x}px`,
        bottom: `${overlayBox.h - (box.y + sp.y)}px`,
        width: `${sp.widthPx}px`,
        height: `${sp.heightPx}px`,
        transform: `translateX(-50%) rotate(${sp.angle}deg)`,
      }"
    >
      <span
        class="comp-fx-aurora-blade"
        :style="{
          '--agrad': sp.grad,
          '--ablur': `${sp.blurPx}px`,
          '--apeak': sp.peak,
          '--adur': `${sp.duration}s`,
          '--adelay': `-${sp.delay}s`,
        }"
      ></span>
    </span>
    <span
      v-for="(ln, j) in lines"
      :key="`line-${j}`"
      class="comp-fx-aurora-line"
      :style="{
        left: `${ln.x}px`,
        top: `${ln.y}px`,
        width: `${ln.w}px`,
        height: `${ln.h}px`,
        background: ln.grad,
        '--apeak': ln.peak,
        '--adur': `${ln.duration}s`,
        '--adelay': `-${ln.delay}s`,
      }"
    ></span>
  </div>
</template>

<style scoped>
.comp-fx-region {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: visible;
}

.comp-fx-aurora {
  position: absolute;
  transform-origin: 50% 100%;
}

.comp-fx-aurora-blade {
  position: absolute;
  inset: 0;
  display: block;
  background: var(--agrad);
  -webkit-mask-image: linear-gradient(to right, transparent 0%, #000 50%, transparent 100%);
  mask-image: linear-gradient(to right, transparent 0%, #000 50%, transparent 100%);
  mix-blend-mode: var(--fx-blend, screen);
  filter: blur(var(--ablur, 3.5px));
  opacity: 0;
  animation: comp-fx-aurora-shine var(--adur, 3.4s) ease-in-out infinite;
  animation-delay: var(--adelay, 0s);
}

@keyframes comp-fx-aurora-shine {
  0%, 100% { opacity: calc(var(--apeak, 0.8) * 0.5); }
  50%      { opacity: var(--apeak, 0.8); }
}

.comp-fx-aurora-line {
  position: absolute;
  mix-blend-mode: var(--fx-blend, screen);
  filter: blur(1.5px);
  border-radius: 2px;
  animation: comp-fx-aurora-shine var(--adur, 4.3s) ease-in-out infinite;
  animation-delay: var(--adelay, 0s);
}

@media (prefers-reduced-motion: reduce) {
  .comp-fx-aurora-blade,
  .comp-fx-aurora-line {
    animation: none;
    opacity: calc(var(--apeak, 0.8) * 0.6);
  }
}
</style>
