<script setup lang="ts">
import TitleAura from '@/components/domain/TitleAura.vue'
import { useTimeline } from '@/composables/useTimeline'
import { useThemeBase } from '@/composables/useThemeBase'
import type { TitleStateValue, TitleValue } from '@/types/api/items'
import { darken } from '@/utils/color'
import {
  gradientToCss,
  interpolateTitleState,
  isAnimated,
  pickInterpolatedState,
} from '@/utils/items'
import { randBetween as rand } from '@/utils/random'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  value: TitleValue
}>()

const reducedMotion = ref(false)
let motionMedia: MediaQueryList | null = null
let motionMediaHandler: (() => void) | null = null

onMounted(() => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
  motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotion.value = motionMedia.matches
  motionMediaHandler = () => { reducedMotion.value = motionMedia!.matches }
  if (typeof motionMedia.addEventListener === 'function') {
    motionMedia.addEventListener('change', motionMediaHandler)
  }
})

onUnmounted(() => {
  if (motionMedia && motionMediaHandler && typeof motionMedia.removeEventListener === 'function') {
    motionMedia.removeEventListener('change', motionMediaHandler)
  }
  motionMedia = null
  motionMediaHandler = null
})

const isPixelFont = computed(() => props.value.font === 'pixel_8bit')

const fxEnabled = computed(() =>
  !reducedMotion.value && (!!props.value.flashes?.enabled || !!props.value.sparkles?.enabled),
)

const needsTimeline = computed(() => {
  if (isAnimated(props.value)) return true
  if (reducedMotion.value) return false
  return props.value.states.some((s) => s.glisten?.enabled) || fxEnabled.value
})

const { tMs } = useTimeline({ active: () => needsTimeline.value })

const themeBase = useThemeBase()
const isLightBase = computed(() => themeBase.value === 'light')

const effectiveStates = computed<TitleStateValue[]>(() => {
  if (!isLightBase.value) return props.value.states
  return props.value.states.map((s) => ({
    ...s,
    color: s.lightColor ?? s.color,
    gradient: s.lightGradient ?? s.gradient,
  }))
})

const state = computed<TitleStateValue>(() =>
  pickInterpolatedState(
    { states: effectiveStates.value, durationMs: props.value.durationMs, loop: props.value.loop },
    tMs.value,
    interpolateTitleState,
  ),
)

const textStyle = computed(() => {
  const out: Record<string, string> = {}
  if (state.value.color) out.color = state.value.color
  if (state.value.fontWeight) out.fontWeight = String(state.value.fontWeight)
  if (state.value.fontStyle) out.fontStyle = state.value.fontStyle
  if (state.value.letterSpacingPx != null) out.letterSpacing = `${state.value.letterSpacingPx}px`
  if (isPixelFont.value && state.value.color) {
    const shadow = darken(state.value.color, 0.6)
    out.textShadow = `1px 1px 0 ${shadow}, 0 1px 0 ${shadow}, 1px 0 0 ${shadow}`
  }
  return out
})

const legacyGradientStyle = computed(() => {
  if (isPixelFont.value) return undefined
  if (!state.value.gradient) return undefined
  return {
    background: gradientToCss(state.value.gradient),
    webkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  } as Record<string, string>
})

const BAND_WIDTH_PCT = 16

const glistenPhase = computed<{ active: boolean; leftPct: number; highlight: string }>(() => {
  const g = state.value.glisten
  if (!g?.enabled || reducedMotion.value) return { active: false, leftPct: 0, highlight: '#ffffff' }
  const interval = g.intervalMs ?? 5000
  const duration = g.durationMs ?? 800
  const cyclePos = tMs.value % interval
  if (cyclePos > duration) return { active: false, leftPct: 0, highlight: g.highlight ?? '#ffffff' }
  const progress = cyclePos / duration
  const leftPct = -BAND_WIDTH_PCT + (100 + BAND_WIDTH_PCT * 2) * progress
  return { active: true, leftPct, highlight: g.highlight ?? '#ffffff' }
})

const glistenClipStyle = computed<Record<string, string> | undefined>(() => {
  const p = glistenPhase.value
  if (!p.active) return undefined
  const right = 100 - p.leftPct - BAND_WIDTH_PCT
  return {
    color: p.highlight,
    clipPath: `inset(0 ${right}% 0 ${p.leftPct}%)`,
    WebkitClipPath: `inset(0 ${right}% 0 ${p.leftPct}%)`,
  }
})

interface FlashInstance {
  id: number
  bornAt: number
  xPct: number
  yPct: number
  rotDeg: number
  lenEm: number
}

interface SparkleInstance {
  id: number
  bornAt: number
  xPct: number
  yPct: number
  sizePx: number
  rotDeg: number
}

const SPARKLE_PATHS = {
  star: 'M5 0 Q5.9 4.1 10 5 Q5.9 5.9 5 10 Q4.1 5.9 0 5 Q4.1 4.1 5 0 Z',
  paw: 'M5,4.8 C6.7,4.8 7.9,5.9 7.9,7.3 C7.9,8.7 6.5,9.4 5,9.4 C3.5,9.4 2.1,8.7 2.1,7.3 C2.1,5.9 3.3,4.8 5,4.8 Z M0.5,3.3 a1,1 0 1,0 2,0 a1,1 0 1,0 -2,0 Z M2.8,1.8 a1,1 0 1,0 2,0 a1,1 0 1,0 -2,0 Z M5.2,1.8 a1,1 0 1,0 2,0 a1,1 0 1,0 -2,0 Z M7.5,3.3 a1,1 0 1,0 2,0 a1,1 0 1,0 -2,0 Z',
} as const

const sparkleShape = computed(() => {
  const shape = props.value.sparkles?.shape
  return shape && shape in SPARKLE_PATHS ? (shape as keyof typeof SPARKLE_PATHS) : 'star'
})
const sparklePath = computed(() => SPARKLE_PATHS[sparkleShape.value])

const ORNAMENT_ICONS: Record<string, { viewBox: string; d: string }> = {
  yarn_ball: {
    viewBox: '0 0 256 256',
    d: 'M69.4 144.89a221 221 0 0 0-18.77 42.6a4 4 0 0 1-7 1.19a103.44 103.44 0 0 1-18.83-48.11a4 4 0 0 1 4.13-4.47a119 119 0 0 1 40.47 8.79M44 77.14a180.1 180.1 0 0 1 63 19.12a227 227 0 0 1 22.6-19.49a206.4 206.4 0 0 0-69.28-25.6a4 4 0 0 0-3.42 1A105.3 105.3 0 0 0 41.08 71A4 4 0 0 0 44 77.14m195.58 144.21A7.91 7.91 0 0 0 232 216h-48.64a104.25 104.25 0 0 0 46.89-69a4 4 0 0 0-5.27-4.52a120.6 120.6 0 0 0-74.1 73.52H134a136.55 136.55 0 0 1 94.78-91.37a4 4 0 0 0 2.92-4.15a102.6 102.6 0 0 0-3.58-20.56a4 4 0 0 0-4.89-2.8A164.53 164.53 0 0 0 103 225a4 4 0 0 0 3.08 4.69A104 104 0 0 0 128 232h104a8 8 0 0 0 7.58-10.65m-211-101.27a134.5 134.5 0 0 1 49.39 11a224 224 0 0 1 17.55-22.68a164.3 164.3 0 0 0-62.16-16.12a4 4 0 0 0-4 2.75a103 103 0 0 0-4.63 20.61a4 4 0 0 0 3.84 4.44Zm57.26-79.42A222.8 222.8 0 0 1 144 66.8a221.3 221.3 0 0 1 38.8-19.67a4 4 0 0 0 .7-7.08a103.86 103.86 0 0 0-98.2-6.85a4 4 0 0 0 .54 7.46M216 82.51a4 4 0 0 0 2.4-5.87a105 105 0 0 0-12.82-17.81a4 4 0 0 0-4.21-1.19A208.81 208.81 0 0 0 62.21 205.51a4 4 0 0 0 1.44 4.13a104.3 104.3 0 0 0 18.55 11.72a4 4 0 0 0 5.71-2.75A180.61 180.61 0 0 1 216 82.51',
  },
  alpha: {
    viewBox: '0 0 24 24',
    d: 'M10.62,6.66 C7.4,6.66 5.28,8.96 5.28,12 C5.28,15.04 7.4,17.34 10.62,17.34 C13.84,17.34 15.96,15.04 15.96,12 C15.96,8.96 13.84,6.66 10.62,6.66 Z M10.62,9.06 C12.55,9.06 13.56,10.34 13.56,12 C13.56,13.66 12.55,14.94 10.62,14.94 C8.69,14.94 7.68,13.66 7.68,12 C7.68,10.34 8.69,9.06 10.62,9.06 Z M19.91,6.85 C17.7,8.87 16.78,10.71 16.97,12.55 C17.15,14.58 18.35,16.42 20.46,18.07 L18.62,19.54 C16.23,17.52 14.94,15.13 14.76,12.74 C14.58,10.16 15.86,7.77 18.44,5.56 Z',
  },
}

const ornament = computed(() => {
  const spec = props.value.ornament
  if (!spec) return null
  const icon = ORNAMENT_ICONS[spec.icon]
  if (!icon) return null
  const color = (isLightBase.value ? spec.lightColor : undefined) ?? spec.color ?? 'currentColor'
  return { ...icon, color, sizeEm: spec.sizeEm ?? 1 }
})

const aura = computed(() => {
  const spec = props.value.aura
  return spec?.enabled ? spec : null
})

const auraKey = computed(() =>
  aura.value ? `${isLightBase.value ? 'l' : 'd'}:${JSON.stringify(aura.value)}` : '',
)

let fxId = 0
let nextFlashAt = -1
let nextSparkleAt = -1
const activeFlashes = ref<FlashInstance[]>([])
const activeSparkles = ref<SparkleInstance[]>([])

watch(
  () => props.value,
  () => {
    activeFlashes.value = []
    activeSparkles.value = []
    nextFlashAt = -1
    nextSparkleAt = -1
  },
)

function spawnFlash(now: number) {
  const zone = Math.floor(Math.random() * 3)
  let xPct: number, yPct: number, rotDeg: number
  if (zone === 0) {
    xPct = rand(-3, 3)
    yPct = rand(15, 85)
    rotDeg = rand(-16, 16)
  } else if (zone === 1) {
    xPct = rand(97, 103)
    yPct = rand(15, 85)
    rotDeg = rand(164, 196)
  } else {
    xPct = rand(25, 75)
    yPct = rand(-60, -35)
    rotDeg = rand(74, 106)
  }
  activeFlashes.value.push({ id: ++fxId, bornAt: now, xPct, yPct, rotDeg, lenEm: rand(1.9, 2.8) })
}

function spawnSparkle(now: number, baseSizePx: number) {
  const spread = props.value.sparkles?.spreadPct ?? 0
  activeSparkles.value.push({
    id: ++fxId,
    bornAt: now,
    xPct: rand(4 - spread, 96 + spread),
    yPct: rand(12 - spread * 3, 88 + spread * 3),
    sizePx: baseSizePx * rand(0.8, 1.4),
    rotDeg: sparkleShape.value === 'paw' ? rand(0, 360) : rand(0, 90),
  })
}

watch(tMs, (now) => {
  if (!fxEnabled.value) return
  const flashes = props.value.flashes
  if (flashes?.enabled) {
    const dur = flashes.durationMs ?? 260
    if (nextFlashAt < 0) nextFlashAt = now + rand(0, flashes.maxIntervalMs ?? 1100)
    if (now >= nextFlashAt) {
      spawnFlash(now)
      nextFlashAt = now + rand(flashes.minIntervalMs ?? 320, flashes.maxIntervalMs ?? 1100)
    }
    if (activeFlashes.value.some((f) => now - f.bornAt >= dur)) {
      activeFlashes.value = activeFlashes.value.filter((f) => now - f.bornAt < dur)
    }
  }
  const sparkles = props.value.sparkles
  if (sparkles?.enabled) {
    const fade = sparkles.fadeMs ?? 700
    if (nextSparkleAt < 0) nextSparkleAt = now
    if (now >= nextSparkleAt) {
      spawnSparkle(now, sparkles.sizePx ?? 5)
      nextSparkleAt = now + (1000 / (sparkles.perSecond ?? 3)) * rand(0.5, 1.5)
    }
    if (activeSparkles.value.some((s) => now - s.bornAt >= fade)) {
      activeSparkles.value = activeSparkles.value.filter((s) => now - s.bornAt < fade)
    }
  }
})

function flashStyle(fl: FlashInstance): Record<string, string> {
  const spec = props.value.flashes
  const dur = spec?.durationMs ?? 260
  const p = Math.min(1, (tMs.value - fl.bornAt) / dur)
  return {
    '--fx-c': (isLightBase.value ? spec?.lightColor : undefined) ?? spec?.color ?? '#ffffff',
    left: `${fl.xPct}%`,
    top: `${fl.yPct}%`,
    width: `${fl.lenEm}em`,
    transform: `translateY(-50%) rotate(${fl.rotDeg}deg) scaleX(${0.8 + 0.35 * p})`,
    opacity: String(Math.pow(1 - p, 1.6) * 0.95),
  }
}

function sparkleStyle(sp: SparkleInstance): Record<string, string> {
  const spec = props.value.sparkles
  const fade = spec?.fadeMs ?? 700
  const p = Math.min(1, (tMs.value - sp.bornAt) / fade)
  const wave = Math.sin(Math.PI * p)
  return {
    color: (isLightBase.value ? spec?.lightColor : undefined) ?? spec?.color ?? '#ffffff',
    left: `${sp.xPct}%`,
    top: `${sp.yPct}%`,
    width: `${sp.sizePx}px`,
    transform: `translate(-50%, -50%) rotate(${sp.rotDeg}deg) scale(${0.6 + 0.5 * wave})`,
    opacity: String(wave),
  }
}
</script>

<template>
  <span
    class="title-renderer"
    :class="{ 'title-renderer--pixel': isPixelFont }"
    :style="textStyle"
  >
    <TitleAura v-if="aura" :key="auraKey" :aura="aura" :light="isLightBase" />
    <span
      v-for="fl in activeFlashes"
      :key="fl.id"
      class="title-renderer__flash"
      :style="flashStyle(fl)"
      aria-hidden="true"
    />
    <svg
      v-if="ornament"
      class="title-renderer__ornament"
      :style="{ height: `${ornament.sizeEm}em` }"
      :viewBox="ornament.viewBox"
      aria-hidden="true"
    >
      <path :d="ornament.d" :fill="ornament.color" />
    </svg>
    <span class="title-renderer__text" :style="legacyGradientStyle">{{ value.text }}</span>
    <span
      v-if="glistenClipStyle"
      class="title-renderer__glint"
      :style="glistenClipStyle"
      aria-hidden="true"
    >{{ value.text }}</span>
    <svg
      v-for="sp in activeSparkles"
      :key="sp.id"
      class="title-renderer__sparkle"
      :style="sparkleStyle(sp)"
      viewBox="0 0 10 10"
      aria-hidden="true"
    >
      <path :d="sparklePath" fill="currentColor" />
    </svg>
  </span>
</template>

<style scoped>
.title-renderer {
  position: relative;
  display: inline-block;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;
}

.title-renderer--pixel {
  font-family: 'Silkscreen', ui-monospace, monospace;
  text-transform: none;
  letter-spacing: 0.02em;
  image-rendering: pixelated;
}

.title-renderer__text {
  position: relative;
  z-index: 1;
}

.title-renderer__ornament {
  position: relative;
  display: inline-block;
  width: auto;
  aspect-ratio: 1 / 1;
  margin-right: 0.28em;
  vertical-align: -0.12em;
  overflow: visible;
  z-index: 1;
}

.title-renderer__glint {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  white-space: inherit;
}

.title-renderer__flash {
  position: absolute;
  height: 0.95em;
  pointer-events: none;
  z-index: 0;
  transform-origin: 0 50%;
  clip-path: polygon(0 50%, 100% 0, 100% 100%);
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--fx-c) 95%, transparent) 0%,
    color-mix(in srgb, var(--fx-c) 60%, transparent) 12%,
    color-mix(in srgb, var(--fx-c) 25%, transparent) 45%,
    transparent 100%
  );
}

.title-renderer__sparkle {
  position: absolute;
  pointer-events: none;
  z-index: 3;
}
</style>
