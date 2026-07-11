<script setup lang="ts">
import { useReducedMotion } from '@/composables/useReducedMotion'
import { useTimeline } from '@/composables/useTimeline'
import type {
  BorderColorValue,
  BorderShapeValue,
  FrameRampBand,
  FrameStreaksPatternStep,
  PaletteDerivation,
  PaletteDerivationOp,
  PaletteStopName,
} from '@/types/api/items'
import { darken, lerpHex, lighten, luminance } from '@/utils/color'
import { interpolateBorderColorState, isAnimated, pickInterpolatedState } from '@/utils/items'
import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue'

const props = defineProps<{
  shape: BorderShapeValue
  color: BorderColorValue | null
}>()

const reducedMotion = useReducedMotion()

const visible = ref(true)
const rootEl = ref<HTMLDivElement | null>(null)
const containerSize = ref({ w: 100, h: 100 })
let observer: IntersectionObserver | null = null
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (!rootEl.value) return
  if (typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible.value = entry.isIntersecting
      },
      { threshold: 0.01 },
    )
    observer.observe(rootEl.value)
  }
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        containerSize.value = { w: entry.contentRect.width, h: entry.contentRect.height }
      }
    })
    resizeObserver.observe(rootEl.value)
  }
  const r = rootEl.value.getBoundingClientRect()
  containerSize.value = { w: r.width, h: r.height }
})

onUnmounted(() => {
  observer?.disconnect()
  observer = null
  resizeObserver?.disconnect()
  resizeObserver = null
})

interface MetalRamp {
  outline: string
  deepShadow: string
  shadow: string
  midShadow: string
  base: string
  midHighlight: string
  highlight: string
  apexHighlight: string
}

const DEFAULT_PALETTE_DERIVATION: PaletteDerivation = {
  outline:       { fn: 'darken',  of: 'shadow',    amount: 0.5 },
  deepShadow:    { fn: 'darken',  of: 'shadow',    amount: 0.35 },
  midShadow:     { fn: 'lerp',    from: 'shadow',  to: 'base',      at: 0.45 },
  midHighlight:  { fn: 'lerp',    from: 'base',    to: 'highlight', at: 0.55 },
  apexHighlight: { fn: 'lighten', of: 'highlight', amount: 0.45 },
}

function applyDerivation(
  op: PaletteDerivationOp | undefined,
  fallback: string,
  resolve: (name: PaletteStopName) => string,
): string {
  if (!op) return fallback
  if (op.fn === 'darken') return darken(resolve(op.of), op.amount)
  if (op.fn === 'lighten') return lighten(resolve(op.of), op.amount)
  if (op.fn === 'lerp') return lerpHex(resolve(op.from), resolve(op.to), op.at)
  return fallback
}

function rampFromTriple(
  shadow: string,
  base: string,
  highlight: string,
  derivation?: PaletteDerivation,
): MetalRamp {
  const d = derivation ?? DEFAULT_PALETTE_DERIVATION
  const resolve = (name: PaletteStopName): string => {
    if (name === 'shadow') return shadow
    if (name === 'base') return base
    if (name === 'highlight') return highlight
    return base
  }
  return {
    outline: applyDerivation(d.outline, darken(shadow, 0.5), resolve),
    deepShadow: applyDerivation(d.deepShadow, darken(shadow, 0.35), resolve),
    shadow,
    midShadow: applyDerivation(d.midShadow, lerpHex(shadow, base, 0.45), resolve),
    base,
    midHighlight: applyDerivation(d.midHighlight, lerpHex(base, highlight, 0.55), resolve),
    highlight,
    apexHighlight: applyDerivation(d.apexHighlight, lighten(highlight, 0.45), resolve),
  }
}


const currentColorState = computed(() => {
  const cv = props.color
  if (!cv || !Array.isArray(cv.states) || cv.states.length === 0) return null
  return pickInterpolatedState(
    { states: cv.states, durationMs: cv.durationMs, loop: cv.loop },
    tMs.value,
    interpolateBorderColorState,
  )
})

const colorIsAnimated = computed(() => isAnimated(props.color))

const ramp = computed<MetalRamp | null>(() => {
  if (colorIsAnimated.value) void tMs.value
  const fill = currentColorState.value?.fill
  if (!fill) return null
  const derivation = props.shape.paletteDerivation
  if (fill.type === 'pixel_metal') {
    return rampFromTriple(fill.shadow, fill.base, fill.highlight, derivation)
  }
  if (fill.type === 'solid') {
    const base = fill.hex
    return rampFromTriple(darken(base, 0.45), base, lighten(base, 0.45), derivation)
  }
  if (fill.type === 'cosmic') {
    const base = fill.nebulas[0] ?? fill.accent
    return rampFromTriple(fill.space, base, lighten(fill.star, 0.1), derivation)
  }
  if (fill.type === 'toon') {
    return rampFromTriple(darken(fill.ink, 0.3), fill.ink, fill.line, derivation)
  }
  if (Array.isArray(fill.stops) && fill.stops.length > 0) {
    const sorted = [...fill.stops].sort((a, b) => luminance(a.hex) - luminance(b.hex))
    const n = sorted.length
    if (n === 1) {
      const base = sorted[0].hex
      return rampFromTriple(darken(base, 0.45), base, lighten(base, 0.45), derivation)
    }
    const shadow = sorted[0].hex
    const highlight = sorted[n - 1].hex
    const base = sorted[Math.floor((n - 1) / 2)].hex
    return rampFromTriple(shadow, base, highlight, derivation)
  }
  return null
})

const pixelSizeLogical = computed(() => props.shape.pixelSize ?? 4)
const motif = computed(() => props.shape.motif ?? 'heart_climb')
const sparkleSpec = computed(() => props.shape.sparkles)
const glistenSpec = computed(() => props.shape.glisten)

const frameSpec = computed(() => props.shape.frame)

const frameThicknessPx = computed(() => {
  const c = Math.min(containerSize.value.w, containerSize.value.h)
  const min = frameSpec.value?.thicknessMinPx ?? 4
  const max = frameSpec.value?.thicknessMaxPx ?? 8
  const prop = frameSpec.value?.thicknessProportional ?? 0.057
  if (c <= 0) return max
  return Math.max(min, Math.min(max, Math.round(c * prop)))
})

const cornerRadiusPx = computed(() => {
  const c = Math.min(containerSize.value.w, containerSize.value.h)
  const min = frameSpec.value?.cornerRadiusMinPx ?? 6
  const prop = frameSpec.value?.cornerRadiusProportional ?? 0.13
  if (c <= 0) return Math.max(min, 16)
  return Math.max(min, Math.round(c * prop))
})

const { tMs } = useTimeline({ active: () => !reducedMotion.value && visible.value })

const HEART_TRAVEL_BASE_MS = 2800
const SPAWN_PERIOD_LEFT_MS = 1500
const SPAWN_PERIOD_RIGHT_MS = 1850

interface Heart {
  id: number
  side: 'left' | 'right'
  bornMs: number
  travelMs: number
  spawnOffsetPx: number
  burst: boolean
}

interface Sparkle {
  id: number
  side: 'left' | 'right'
  bornMs: number
  vx: number
  vy: number
  lifeMs: number
}

const hearts = ref<Heart[]>([])
const sparkles = ref<Sparkle[]>([])

let nextSpawnLeftMs = 300
let nextSpawnRightMs = 800
let lastT = 0
let nextId = 1

function jitter(periodMs: number): number {
  return periodMs * (0.65 + Math.random() * 0.7)
}

function randomSpawnOffset(thicknessPx: number): number {
  return (Math.random() * 1.4 - 0.35) * thicknessPx
}

function tick(t: number) {
  if (reducedMotion.value || !visible.value || ramp.value == null) {
    if (hearts.value.length > 0) hearts.value = []
    if (sparkles.value.length > 0) sparkles.value = []
    return
  }
  if (t < lastT) {
    hearts.value = []
    sparkles.value = []
    nextSpawnLeftMs = 300
    nextSpawnRightMs = 800
  }
  lastT = t

  let next: Heart[] | null = null

  while (t >= nextSpawnLeftMs) {
    next ??= [...hearts.value]
    next.push({
      id: nextId++,
      side: 'left',
      bornMs: nextSpawnLeftMs,
      travelMs: HEART_TRAVEL_BASE_MS * (0.85 + Math.random() * 0.4),
      spawnOffsetPx: randomSpawnOffset(frameThicknessPx.value),
      burst: false,
    })
    nextSpawnLeftMs += jitter(SPAWN_PERIOD_LEFT_MS)
  }
  while (t >= nextSpawnRightMs) {
    next ??= [...hearts.value]
    next.push({
      id: nextId++,
      side: 'right',
      bornMs: nextSpawnRightMs,
      travelMs: HEART_TRAVEL_BASE_MS * (0.85 + Math.random() * 0.4),
      spawnOffsetPx: randomSpawnOffset(frameThicknessPx.value),
      burst: false,
    })
    nextSpawnRightMs += jitter(SPAWN_PERIOD_RIGHT_MS)
  }

  const working = next ?? hearts.value
  let nextSparkles: Sparkle[] | null = null

  for (const p of working) {
    const dt = t - p.bornMs
    if (!p.burst && dt >= p.travelMs && sparkleSpec.value?.enabled) {
      p.burst = true
      if (next == null) next = [...hearts.value]
      const count = 4 + Math.floor(Math.random() * 2)
      nextSparkles ??= [...sparkles.value]
      for (let i = 0; i < count; i++) {
        const sign = p.side === 'left' ? -1 : 1
        const baseAngle = -Math.PI / 2 + sign * 0.45
        const angle = baseAngle + (Math.random() - 0.5) * Math.PI * 0.7
        const speed = 0.9 + Math.random() * 1.1
        nextSparkles.push({
          id: nextId++,
          side: p.side,
          bornMs: t,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          lifeMs: 750 + Math.random() * 300,
        })
      }
    }
  }

  const TRAIL_MS = 200
  const cleaned = working.filter((p) => t - p.bornMs < p.travelMs + TRAIL_MS)
  if (cleaned.length !== hearts.value.length || next) {
    hearts.value = cleaned
  }

  if (nextSparkles) {
    const cleanedSparkles = nextSparkles.filter((s) => t - s.bornMs < s.lifeMs)
    sparkles.value = cleanedSparkles
  } else if (sparkles.value.length > 0) {
    const cleanedSparkles = sparkles.value.filter((s) => t - s.bornMs < s.lifeMs)
    if (cleanedSparkles.length !== sparkles.value.length) sparkles.value = cleanedSparkles
  }
}

watchEffect(() => tick(tMs.value))

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4)
}

function heartProgress(p: Heart): number {
  const dt = tMs.value - p.bornMs
  if (dt < 0) return 0
  if (dt > p.travelMs) return 1
  return dt / p.travelMs
}

function heartYPct(p: Heart): number {
  const halfPct = containerSize.value.h > 0
    ? (heartSizePx.value / 2 / containerSize.value.h) * 100
    : 6
  const startY = 100 + halfPct
  return startY - easeOutQuart(heartProgress(p)) * startY
}

const heartSizePx = computed(() => Math.max(12, Math.round(frameThicknessPx.value * 2)))

function pixelSnap(yPct: number): number {
  const step = (heartSizePx.value / 4) / containerSize.value.h * 100
  if (step <= 0) return yPct
  return Math.round(yPct / step) * step
}

function heartOpacity(p: Heart): number {
  const dt = tMs.value - p.bornMs
  if (dt < 0) return 0
  if (dt >= p.travelMs) return Math.max(0, 1 - (dt - p.travelMs) / 200)
  if (dt < 180) return dt / 180
  return 1
}

function heartFillColors(p: Heart): { lit: string; shaded: string } {
  const r = ramp.value
  if (!r) return { lit: 'currentColor', shaded: 'currentColor' }
  const stops = [r.deepShadow, r.shadow, r.midShadow, r.base, r.midHighlight, r.highlight, r.apexHighlight]
  const prog = 1 - heartYPct(p) / 100
  const idx = Math.min(stops.length - 2, Math.max(0, Math.floor(prog * (stops.length - 1))))
  return { shaded: stops[idx], lit: stops[idx + 1] }
}

function sparkleLife(s: Sparkle): { x: number; y: number; opacity: number; scale: number } {
  const dt = tMs.value - s.bornMs
  const t = Math.min(1, Math.max(0, dt / s.lifeMs))
  const drift = easeOutQuart(t)
  const distancePx = Math.max(16, frameThicknessPx.value * 2.8)
  return {
    x: s.vx * drift * distancePx,
    y: s.vy * drift * distancePx,
    opacity: Math.max(0, 1 - t * t),
    scale: 1 + (1 - t) * 0.8,
  }
}

const glistenStyle = computed<Record<string, string>>(() => {
  const spec = glistenSpec.value
  const r = ramp.value
  const base: Record<string, string> = {
    background: 'transparent',
    opacity: '0',
    mixBlendMode: 'screen',
  }
  if (!spec?.enabled || reducedMotion.value || !r) return base
  const interval = spec.intervalMs ?? 5000
  const duration = spec.durationMs ?? 800
  const bandPct = spec.bandPctOfDiagonal ?? 30
  const cyclePos = tMs.value % interval
  if (cyclePos > duration) return base
  const progress = cyclePos / duration
  const center = -bandPct + (100 + bandPct) * progress
  const half = bandPct / 2
  base.background = `linear-gradient(135deg, transparent ${center - half}%, ${r.highlight} ${center}%, transparent ${center + half}%)`
  base.opacity = '0.55'
  return base
})

const sparkleSizePx = computed(() => Math.max(4, Math.round(frameThicknessPx.value * 0.4)))

const DEFAULT_RAMP_BANDS: FrameRampBand[] = [
  { upToPct: 6, stop: 'apexHighlight' },
  { upToPct: 15, stop: 'highlight' },
  { upToPct: 28, stop: 'midHighlight' },
  { upToPct: 45, stop: 'base' },
  { upToPct: 60, stop: 'midShadow' },
  { upToPct: 78, stop: 'shadow' },
  { upToPct: 92, stop: 'deepShadow' },
  { upToPct: 100, stop: 'outline' },
]

const DEFAULT_STREAKS_PATTERN: FrameStreaksPatternStep[] = [
  { stop: null, lengthPx: 11 },
  { stop: 'apexHighlight', lengthPx: 1 },
  { stop: null, lengthPx: 15 },
  { stop: 'highlight', lengthPx: 1 },
  { stop: null, lengthPx: 15 },
]

function resolveStop(r: MetalRamp, name: PaletteStopName | null): string {
  if (!name) return 'transparent'
  return r[name]
}

const frameStyle = computed(() => {
  const r = ramp.value
  if (!r) return undefined
  const bands = frameSpec.value?.ramp?.bands ?? DEFAULT_RAMP_BANDS
  const rampAngle = frameSpec.value?.ramp?.angleDeg ?? 168
  const streakPattern = frameSpec.value?.streaks?.pattern ?? DEFAULT_STREAKS_PATTERN
  const streakAngle = frameSpec.value?.streaks?.angleDeg ?? 11
  const streakBlend = frameSpec.value?.streaks?.blendMode ?? 'overlay'
  const outlineWidth = frameSpec.value?.outlineWidthPx ?? 1

  const bandParts: string[] = []
  let prevPct = 0
  for (const band of bands) {
    bandParts.push(`${resolveStop(r, band.stop)} ${prevPct}% ${band.upToPct}%`)
    prevPct = band.upToPct
  }
  const mainRamp = `linear-gradient(${rampAngle}deg, ${bandParts.join(', ')})`

  const streakParts: string[] = []
  let cursorPx = 0
  for (const step of streakPattern) {
    const color = resolveStop(r, step.stop)
    streakParts.push(`${color} ${cursorPx}px`)
    cursorPx += step.lengthPx
    streakParts.push(`${color} ${cursorPx}px`)
  }
  const streaks = `repeating-linear-gradient(${streakAngle}deg, ${streakParts.join(', ')})`

  return {
    borderRadius: `${cornerRadiusPx.value}px`,
    backgroundImage: `${streaks}, ${mainRamp}`,
    backgroundBlendMode: `${streakBlend}, normal`,
    boxShadow: `0 0 0 ${outlineWidth}px ${r.outline}`,
  }
})

const rootStyle = computed<Record<string, string> | undefined>(() => {
  const r = ramp.value
  if (!r) return undefined
  return {
    '--pb-base': r.base,
    '--pb-highlight': r.highlight,
    '--pb-shadow': r.shadow,
    '--pb-outline': r.outline,
    '--pb-tx': `${frameThicknessPx.value}px`,
    '--pb-radius': `${cornerRadiusPx.value}px`,
  }
})
</script>

<template>
  <div
    ref="rootEl"
    class="pixel-border"
    aria-hidden="true"
    :style="rootStyle"
  >
    <div v-if="ramp" class="pixel-border__frame" :style="frameStyle"></div>

    <svg
      v-if="ramp && motif === 'heart_climb' && hearts.length > 0"
      class="pixel-border__hearts"
      :width="containerSize.w"
      :height="containerSize.h"
      :viewBox="`0 0 ${containerSize.w} ${containerSize.h}`"
      aria-hidden="true"
      shape-rendering="crispEdges"
    >
      <defs>
        <linearGradient
          v-for="p in hearts"
          :key="`grad-${p.id}`"
          :id="`pb-heart-grad-${p.id}`"
          x1="0" y1="0" x2="1" y2="1"
        >
          <stop offset="0" :stop-color="heartFillColors(p).lit" />
          <stop offset="0.45" :stop-color="heartFillColors(p).lit" />
          <stop offset="0.45" :stop-color="heartFillColors(p).shaded" />
          <stop offset="1" :stop-color="heartFillColors(p).shaded" />
        </linearGradient>
      </defs>
      <g
        v-for="p in hearts"
        :key="p.id"
        :transform="`translate(${p.side === 'left' ? (frameThicknessPx / 2 + p.spawnOffsetPx) : (containerSize.w - frameThicknessPx / 2 - p.spawnOffsetPx)}, ${pixelSnap(heartYPct(p)) / 100 * containerSize.h})`"
        :opacity="heartOpacity(p)"
      >
        <g :transform="`translate(${-heartSizePx / 2}, ${-heartSizePx / 2}) scale(${heartSizePx / 7})`">
          <g
            :fill="`url(#pb-heart-grad-${p.id})`"
            :stroke="ramp?.outline"
            stroke-width="0.45"
            paint-order="stroke fill"
            stroke-linejoin="miter"
          >
            <rect x="1" y="0" width="2" height="1" />
            <rect x="4" y="0" width="2" height="1" />
            <rect x="0" y="1" width="7" height="2" />
            <rect x="1" y="3" width="5" height="1" />
            <rect x="2" y="4" width="3" height="1" />
            <rect x="3" y="5" width="1" height="1" />
          </g>
          <g :fill="ramp?.apexHighlight">
            <rect x="1" y="1" width="1" height="1" />
            <rect x="4" y="1" width="1" height="1" />
          </g>
        </g>
      </g>
    </svg>

    <div
      v-for="s in sparkles"
      :key="s.id"
      class="pixel-border__sparkle"
      :class="`pixel-border__sparkle--${s.side}`"
      :style="{
        opacity: sparkleLife(s).opacity,
        width: `${sparkleSizePx}px`,
        height: `${sparkleSizePx}px`,
        '--sx': `${sparkleLife(s).x}px`,
        '--sy': `${sparkleLife(s).y}px`,
        '--ss': sparkleLife(s).scale,
      }"
    ></div>

    <div v-if="ramp" class="pixel-border__glisten" :style="glistenStyle"></div>
  </div>
</template>

<style scoped>
.pixel-border {
  position: absolute;
  inset: 0;
  pointer-events: none;
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
}

.pixel-border__frame {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.pixel-border__hearts {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: visible;
  z-index: 5;
}

.pixel-border__sparkle {
  position: absolute;
  top: 0;
  background: var(--pb-highlight);
  box-shadow: 0 0 0 1px var(--pb-outline), 0 0 10px var(--pb-highlight);
  border-radius: 1px;
  z-index: 6;
}

.pixel-border__sparkle--left {
  left: calc(var(--pb-tx) / 2);
  transform: translate(calc(-50% + var(--sx, 0px)), calc(-50% + var(--sy, 0px))) scale(var(--ss, 1));
}

.pixel-border__sparkle--right {
  right: calc(var(--pb-tx) / 2);
  transform: translate(calc(50% + var(--sx, 0px)), calc(-50% + var(--sy, 0px))) scale(var(--ss, 1));
}

.pixel-border__glisten {
  position: absolute;
  inset: 0;
  border-radius: var(--pb-radius);
  pointer-events: none;
  z-index: 4;
  overflow: hidden;
}

@media (prefers-reduced-motion: reduce) {
  .pixel-border__hearts,
  .pixel-border__sparkle,
  .pixel-border__glisten {
    display: none;
  }
}
</style>
