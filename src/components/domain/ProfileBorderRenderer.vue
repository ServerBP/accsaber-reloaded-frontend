<script setup lang="ts">
import { useReducedMotion } from '@/composables/useReducedMotion'
import { useTimeline } from '@/composables/useTimeline'
import CosmicBorderFill from '@/components/domain/CosmicBorderFill.vue'
import ToonBorderFill from '@/components/domain/ToonBorderFill.vue'
import type {
  BorderColorStateValue,
  BorderColorValue,
  BorderShapePathValue,
  BorderShapeStateValue,
  BorderShapeValue,
  CosmicFill,
  Gradient,
  ToonFill,
} from '@/types/api/items'
import {
  fillToCss,
  gradientToCss,
  interpolateBorderColorState,
  isAnimated,
  lerpPoints,
  pickInterpolatedState,
  pointsToPathD,
  sampleShapeStates,
} from '@/utils/items'
import { randBetween as rand } from '@/utils/random'
import { computed, ref, watch } from 'vue'
import PixelBorderRenderer from './PixelBorderRenderer.vue'

const props = defineProps<{
  shape: BorderShapeValue | null
  color: BorderColorValue | null
}>()

const reducedMotion = useReducedMotion()

const isPixelShape = computed(() => props.shape?.renderMode === 'pixel')

const colorIsConic = computed(() => props.color?.states?.[0]?.fill?.type === 'conic')

const cosmicFill = computed<CosmicFill | null>(() => {
  const fill = props.color?.states?.[0]?.fill
  return fill?.type === 'cosmic' ? fill : null
})

const toonFill = computed<ToonFill | null>(() => {
  const fill = props.color?.states?.[0]?.fill
  return fill?.type === 'toon' ? fill : null
})

const canvasFillActive = computed(() => !!cosmicFill.value || !!toonFill.value)

const rimStyle = computed<{ stroke: string; width: number; opacity: number } | null>(() => {
  if (cosmicFill.value) return { stroke: cosmicFill.value.star, width: 0.8, opacity: 0.45 }
  if (toonFill.value) return { stroke: toonFill.value.line, width: 1.4, opacity: 1 }
  return null
})

const cosmicSink = computed<{ x: number; y: number; r: number } | null>(() => {
  const overlay = props.shape?.overlay
  if (!cosmicFill.value || overlay?.type !== 'blackhole' || !overlay.enabled) return null
  if (overlay.suction?.fillType !== 'cosmic') return null
  return { x: 50, y: 100, r: 8.8 }
})

const shapeFxActive = computed(
  () =>
    !reducedMotion.value
    && !isPixelShape.value
    && (!!props.shape?.glisten?.enabled || !!props.shape?.sparkles?.enabled),
)

const needsTimeline = computed(
  () =>
    isAnimated(props.color)
    || (colorIsConic.value && isAnimated(props.shape))
    || isAnimated(props.shape)
    || shapeFxActive.value,
)

const { tMs } = useTimeline({ active: () => needsTimeline.value })

const colorState = computed<BorderColorStateValue | null>(() => {
  const cv = props.color
  if (!cv) return null
  return pickInterpolatedState(
    { states: cv.states, durationMs: cv.durationMs, loop: cv.loop },
    tMs.value,
    interpolateBorderColorState,
  )
})

const effectiveGradient = computed<Gradient | null>(() => {
  const fill = colorState.value?.fill
  if (!fill) return null
  if (fill.type === 'linear' || fill.type === 'radial' || fill.type === 'conic') return fill
  if (fill.type === 'pixel_metal') {
    return {
      type: 'linear',
      angleDeg: 135,
      stops: [
        { atPct: 0, hex: fill.highlight },
        { atPct: 50, hex: fill.base },
        { atPct: 100, hex: fill.shadow },
      ],
    }
  }
  return null
})

const colorIsSvgGradient = computed(() => {
  const eg = effectiveGradient.value
  return eg?.type === 'linear' || eg?.type === 'radial'
})

const solidColor = computed<string | null>(() => {
  const fill = colorState.value?.fill
  if (fill && fill.type === 'solid') return fill.hex
  return null
})

const vbBounds = computed(() => {
  const vb = props.shape?.viewBox ?? '0 0 100 100'
  const parts = vb.split(/[\s,]+/).map(Number)
  const valid = parts.length === 4 && parts.every((n) => Number.isFinite(n))
  const [minX, minY, w, h] = valid ? parts : [0, 0, 100, 100]
  return { minX, minY, w, h }
})

const linearGradAttrs = computed(() => {
  const { minX, minY, w, h } = vbBounds.value
  const g = effectiveGradient.value
  const angle = g && g.type === 'linear' ? g.angleDeg : 0
  return {
    x1: minX,
    y1: minY + h / 2,
    x2: minX + w,
    y2: minY + h / 2,
    transform: `rotate(${angle} ${minX + w / 2} ${minY + h / 2})`,
  }
})

const radialGradAttrs = computed(() => {
  const { minX, minY, w, h } = vbBounds.value
  const g = effectiveGradient.value
  const cxPct = g && g.type === 'radial' ? (g.centerXPct ?? 50) : 50
  const cyPct = g && g.type === 'radial' ? (g.centerYPct ?? 50) : 50
  const rPct = g && g.type === 'radial' ? (g.radiusPct ?? 50) : 50
  return {
    cx: minX + (w * cxPct) / 100,
    cy: minY + (h * cyPct) / 100,
    r: (Math.min(w, h) * rPct) / 100,
  }
})

const sortedShapeStates = computed<BorderShapeStateValue[]>(() => {
  const sv = props.shape
  if (!sv) return []
  return [...sv.states].sort((a, b) => a.atMs - b.atMs)
})

const basePaths = computed(() => sortedShapeStates.value[0]?.paths ?? [])

const SHAPE_SAMPLES = 100

const sampledStates = computed<Array<Array<[number, number][]>> | null>(() => {
  const states = sortedShapeStates.value
  if (states.length < 2) return null
  try {
    return sampleShapeStates(states, SHAPE_SAMPLES)
  } catch {
    return null
  }
})

function easeInOutLocal(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

interface ShapeBracket {
  idxA: number
  idxB: number
  localT: number
}

function currentShapeBracket(): ShapeBracket | null {
  const sv = props.shape
  const states = sortedShapeStates.value
  if (!sv || states.length === 0) return null
  if (states.length === 1) return { idxA: 0, idxB: 0, localT: 0 }
  const lastAt = states[states.length - 1].atMs
  const total = sv.durationMs ?? lastAt
  if (total <= 0) return { idxA: 0, idxB: 0, localT: 0 }
  const loop = sv.loop ?? 'loop'
  let t: number
  const tNow = tMs.value
  if (loop === 'once') t = Math.min(Math.max(tNow, 0), total)
  else if (loop === 'pingpong') {
    const cycles = Math.floor(tNow / total)
    const inCycle = tNow - cycles * total
    t = cycles % 2 === 0 ? inCycle : total - inCycle
  } else t = ((tNow % total) + total) % total

  if (loop === 'loop' && t > lastAt) {
    const range = total - lastAt
    return {
      idxA: states.length - 1,
      idxB: 0,
      localT: range > 0 ? (t - lastAt) / range : 0,
    }
  }
  for (let i = 0; i < states.length - 1; i++) {
    if (t >= states[i].atMs && t <= states[i + 1].atMs) {
      const range = states[i + 1].atMs - states[i].atMs
      return { idxA: i, idxB: i + 1, localT: range > 0 ? (t - states[i].atMs) / range : 0 }
    }
  }
  if (t <= states[0].atMs) return { idxA: 0, idxB: 0, localT: 0 }
  return { idxA: states.length - 1, idxB: states.length - 1, localT: 0 }
}

const lerpedPaths = computed<string[] | null>(() => {
  const states = sortedShapeStates.value
  if (states.length === 0) return null
  if (states.length === 1) return (states[0].paths ?? []).map((p) => p.d)
  const samples = sampledStates.value
  if (!samples) return (states[0].paths ?? []).map((p) => p.d)
  const bracket = currentShapeBracket()
  if (!bracket) return (states[0].paths ?? []).map((p) => p.d)
  if (bracket.idxA === bracket.idxB) {
    return samples[bracket.idxA].map(pointsToPathD)
  }
  const a = samples[bracket.idxA]
  const b = samples[bracket.idxB]
  const eased = easeInOutLocal(bracket.localT)
  const pathCount = Math.min(a.length, b.length)
  const out: string[] = []
  for (let pi = 0; pi < pathCount; pi++) {
    out.push(pointsToPathD(lerpPoints(a[pi], b[pi], eased)))
  }
  return out
})

let gradientIdCounter = 0
const gradientId = `pbr-grad-${++gradientIdCounter}-${Math.random().toString(36).slice(2, 8)}`
const clipId = `pbr-clip-${gradientIdCounter}-${Math.random().toString(36).slice(2, 8)}`
const glistenGradId = `pbr-glint-${gradientIdCounter}-${Math.random().toString(36).slice(2, 8)}`

const glistenBand = computed(() => {
  const g = props.shape?.glisten
  if (!g?.enabled || reducedMotion.value) return null
  const interval = g.intervalMs ?? 5000
  const duration = g.durationMs ?? 900
  const cyclePos = tMs.value % interval
  if (cyclePos > duration) return null
  const progress = cyclePos / duration
  const { minX, minY, w, h } = vbBounds.value
  const diag = Math.hypot(w, h)
  const bandW = ((g.bandPctOfDiagonal ?? 18) / 100) * diag
  const startX = minX - 60 - bandW
  const endX = minX + w + 60
  return {
    x: startX + (endX - startX) * progress,
    y: minY - 60,
    width: bandW,
    height: h + 120,
    transform: `rotate(22 ${minX + w / 2} ${minY + h / 2})`,
  }
})

const SHAPE_STAR_D = 'M0,-5 Q0.9,-0.9 5,0 Q0.9,0.9 0,5 Q-0.9,0.9 -5,0 Q-0.9,-0.9 0,-5 Z'

interface ShapeSparkle {
  id: number
  bornAt: number
  x: number
  y: number
  size: number
  rot: number
}

let shapeSparkleId = 0
let nextShapeSparkleAt = -1
const activeShapeSparkles = ref<ShapeSparkle[]>([])

watch(() => props.shape, () => {
  activeShapeSparkles.value = []
  nextShapeSparkleAt = -1
})

watch(tMs, (now) => {
  const spec = props.shape?.sparkles
  if (!spec?.enabled || reducedMotion.value || isPixelShape.value) return
  const fade = spec.fadeMs ?? 900
  if (nextShapeSparkleAt < 0) nextShapeSparkleAt = now
  if (now >= nextShapeSparkleAt) {
    const { minX, minY, w, h } = vbBounds.value
    activeShapeSparkles.value.push({
      id: ++shapeSparkleId,
      bornAt: now,
      x: rand(minX - 15, minX + w + 15),
      y: rand(minY - 35, minY + h + 20),
      size: (spec.sizePx ?? 4) * rand(0.8, 1.4),
      rot: rand(0, 90),
    })
    nextShapeSparkleAt = now + (1000 / (spec.perSecond ?? 2)) * rand(0.5, 1.5)
  }
  if (activeShapeSparkles.value.some((s) => now - s.bornAt >= fade)) {
    activeShapeSparkles.value = activeShapeSparkles.value.filter((s) => now - s.bornAt < fade)
  }
})

function shapeSparkleOpacity(s: ShapeSparkle): number {
  const fade = props.shape?.sparkles?.fadeMs ?? 900
  const p = Math.min(1, (tMs.value - s.bornAt) / fade)
  return Math.sin(Math.PI * p)
}

function shapeSparkleTransform(s: ShapeSparkle): string {
  const fade = props.shape?.sparkles?.fadeMs ?? 900
  const p = Math.min(1, (tMs.value - s.bornAt) / fade)
  const k = (s.size / 10) * (0.6 + 0.5 * Math.sin(Math.PI * p))
  return `translate(${s.x} ${s.y}) rotate(${s.rot}) scale(${k})`
}

const fallbackColor = 'currentColor'
const svgColor = computed(() => solidColor.value ?? fallbackColor)

function pathStrokeRef(p: BorderShapePathValue): string | undefined {
  const stroke = p.stroke
  if (!stroke) return undefined
  if (colorIsSvgGradient.value && (stroke === 'currentColor' || stroke === 'inherit')) {
    return `url(#${gradientId})`
  }
  return stroke
}

function pathFillRef(p: BorderShapePathValue): string | undefined {
  const fill = p.fill
  if (!fill) return 'none'
  if (colorIsSvgGradient.value && (fill === 'currentColor' || fill === 'inherit')) {
    return `url(#${gradientId})`
  }
  return fill
}

const conicMaskStyle = computed<Record<string, string> | undefined>(() => {
  if (!colorIsConic.value) return undefined
  if (!colorState.value || colorState.value.fill.type !== 'conic') return undefined
  const lerped = lerpedPaths.value
  const reference = basePaths.value
  if (!lerped || reference.length === 0) return undefined
  const viewBox = props.shape?.viewBox ?? '0 0 100 100'
  const { w, h } = vbBounds.value
  const inner = reference
    .map((p, i) => {
      const d = lerped[i] ?? p.d
      const stroke = p.stroke && p.stroke !== 'currentColor' && p.stroke !== 'inherit' ? p.stroke : 'white'
      const fill = p.fill && p.fill !== 'currentColor' && p.fill !== 'inherit' ? p.fill : 'none'
      const sw = p.strokeWidth ?? 1
      return `<path d="${d}" stroke="${stroke}" stroke-width="${sw}" fill="${fill}" stroke-linecap="${p.strokeLinecap ?? 'butt'}" stroke-linejoin="${p.strokeLinejoin ?? 'miter'}" ${p.transform ? `transform="${p.transform}"` : ''} />`
    })
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${viewBox}" preserveAspectRatio="none">${inner}</svg>`
  const mask = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`
  return {
    background: gradientToCss(colorState.value.fill),
    maskImage: mask,
    webkitMaskImage: mask,
    maskSize: '100% 100%',
    webkitMaskSize: '100% 100%',
    maskRepeat: 'no-repeat',
    webkitMaskRepeat: 'no-repeat',
  }
})

const DEFAULT_RING_D
  = 'M6,0 L94,0 Q100,0 100,6 L100,94 Q100,100 94,100 L6,100 Q0,100 0,94 L0,6 Q0,0 6,0 Z'

function isThemedRef(ref: string | undefined): boolean {
  return ref === 'currentColor' || ref === 'inherit'
}

const decorationPaths = computed(() => {
  if (!props.shape) return []
  const lerped = lerpedPaths.value
  return basePaths.value
    .map((p, i) => ({ path: p, d: lerped?.[i] ?? p.d }))
    .filter(({ path }) => {
      const paintedFill = !!path.fill && path.fill !== 'none' && !isThemedRef(path.fill)
      const paintedStroke = !!path.stroke && path.stroke !== 'none' && !isThemedRef(path.stroke)
      return paintedFill || paintedStroke
    })
})

const rimPaths = computed(() => {
  if (!props.shape || !rimStyle.value) return []
  const lerped = lerpedPaths.value
  return basePaths.value
    .map((p, i) => ({ path: p, d: lerped?.[i] ?? p.d }))
    .filter(({ path }) =>
      (!!path.fill && isThemedRef(path.fill)) || (!!path.stroke && isThemedRef(path.stroke)),
    )
})

const cosmicViewBox = computed(() => {
  const { minX, minY, w, h } = vbBounds.value
  const mx = w * 0.25
  const my = h * 0.25
  return `${minX - mx} ${minY - my} ${w + mx * 2} ${h + my * 2}`
})

const cosmicMaskStyle = computed<Record<string, string> | undefined>(() => {
  if (!canvasFillActive.value) return undefined
  const { minX, minY, w, h } = vbBounds.value
  const mx = w * 0.25
  const my = h * 0.25
  const vbW = w + mx * 2
  const vbH = h + my * 2
  const viewBox = `${minX - mx} ${minY - my} ${vbW} ${vbH}`
  let inner: string
  if (props.shape && basePaths.value.length > 0) {
    inner = sortedShapeStates.value
      .flatMap((state) => state.paths ?? [])
      .map((p) => {
        const stroke = p.stroke && p.stroke !== 'none' ? 'white' : 'none'
        const fill = p.fill && p.fill !== 'none' ? 'white' : 'none'
        const sw = p.strokeWidth ?? 1
        return `<path d="${p.d}" stroke="${stroke}" stroke-width="${sw}" fill="${fill}" stroke-linecap="${p.strokeLinecap ?? 'butt'}" stroke-linejoin="${p.strokeLinejoin ?? 'miter'}" ${p.transform ? `transform="${p.transform}"` : ''} />`
      })
      .join('')
  } else {
    inner = `<path d="${DEFAULT_RING_D}" fill="white" />`
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${vbW}" height="${vbH}" viewBox="${viewBox}" preserveAspectRatio="none">${inner}</svg>`
  const mask = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`
  return {
    maskImage: mask,
    webkitMaskImage: mask,
    maskSize: '100% 100%',
    webkitMaskSize: '100% 100%',
    maskRepeat: 'no-repeat',
    webkitMaskRepeat: 'no-repeat',
  }
})

const ringStyle = computed<Record<string, string> | undefined>(() => {
  if (props.shape) return undefined
  const fill = colorState.value?.fill
  if (!fill) return undefined
  return {
    background: fillToCss(fill),
  }
})
</script>

<template>
  <PixelBorderRenderer
    v-if="isPixelShape && shape"
    :shape="shape"
    :color="color"
  />
  <div
    v-else-if="canvasFillActive && cosmicMaskStyle"
    class="profile-border__cosmic"
    :style="cosmicMaskStyle"
    aria-hidden="true"
  >
    <CosmicBorderFill v-if="cosmicFill" :fill="cosmicFill" :sink="cosmicSink" />
    <ToonBorderFill v-else-if="toonFill" :fill="toonFill" />
    <svg
      v-if="rimPaths.length || decorationPaths.length"
      class="profile-border__cosmic-decor"
      :viewBox="cosmicViewBox"
      preserveAspectRatio="none"
    >
      <g v-if="rimStyle">
        <path
          v-for="(entry, i) in rimPaths"
          :key="i"
          :d="entry.d"
          fill="none"
          :stroke="rimStyle.stroke"
          :stroke-width="rimStyle.width"
          :stroke-opacity="rimStyle.opacity"
          stroke-linejoin="round"
          :transform="entry.path.transform"
        />
      </g>
      <path
        v-for="(entry, i) in decorationPaths"
        :key="`d${i}`"
        :d="entry.d"
        :class="{ 'pbr-twinkle': entry.path.twinkle }"
        :style="entry.path.twinkle ? { animationDelay: `${(i % 4) * 0.6}s` } : undefined"
        :fill="entry.path.fill && entry.path.fill !== 'none' && !isThemedRef(entry.path.fill) ? entry.path.fill : 'none'"
        :fill-opacity="entry.path.fillOpacity"
        :stroke="entry.path.stroke && entry.path.stroke !== 'none' && !isThemedRef(entry.path.stroke) ? entry.path.stroke : 'none'"
        :stroke-width="entry.path.strokeWidth"
        :stroke-opacity="entry.path.strokeOpacity"
        :stroke-linecap="entry.path.strokeLinecap"
        :stroke-linejoin="entry.path.strokeLinejoin"
        :transform="entry.path.transform"
      />
    </svg>
  </div>
  <div
    v-else-if="basePaths.length && colorIsConic"
    class="profile-border__conic"
    :style="conicMaskStyle"
    aria-hidden="true"
  ></div>
  <svg
    v-else-if="basePaths.length"
    class="profile-border__shape"
    :viewBox="shape?.viewBox ?? '0 0 100 100'"
    preserveAspectRatio="none"
    :style="{ color: svgColor }"
    aria-hidden="true"
  >
    <defs v-if="colorIsSvgGradient && effectiveGradient">
      <linearGradient
        v-if="effectiveGradient.type === 'linear'"
        :id="gradientId"
        gradientUnits="userSpaceOnUse"
        :x1="linearGradAttrs.x1"
        :y1="linearGradAttrs.y1"
        :x2="linearGradAttrs.x2"
        :y2="linearGradAttrs.y2"
        :gradientTransform="linearGradAttrs.transform"
      >
        <stop
          v-for="(s, i) in effectiveGradient.stops"
          :key="i"
          :offset="`${s.atPct}%`"
          :stop-color="s.hex"
        />
      </linearGradient>
      <radialGradient
        v-else-if="effectiveGradient.type === 'radial'"
        :id="gradientId"
        gradientUnits="userSpaceOnUse"
        :cx="radialGradAttrs.cx"
        :cy="radialGradAttrs.cy"
        :r="radialGradAttrs.r"
      >
        <stop
          v-for="(s, i) in effectiveGradient.stops"
          :key="i"
          :offset="`${s.atPct}%`"
          :stop-color="s.hex"
        />
      </radialGradient>
    </defs>
    <defs v-if="shapeFxActive">
      <clipPath :id="clipId">
        <path
          v-for="(p, i) in basePaths"
          :key="i"
          :d="lerpedPaths?.[i] ?? p.d"
          :transform="p.transform"
        />
      </clipPath>
      <linearGradient :id="glistenGradId" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0" />
        <stop offset="0.5" stop-color="#ffffff" stop-opacity="0.55" />
        <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
      </linearGradient>
    </defs>
    <path
      v-for="(p, i) in basePaths"
      :key="i"
      :d="lerpedPaths?.[i] ?? p.d"
      :class="{ 'pbr-twinkle': p.twinkle }"
      :style="p.twinkle ? { animationDelay: `${(i % 4) * 0.6}s` } : undefined"
      :stroke="pathStrokeRef(p)"
      :stroke-width="p.strokeWidth"
      :stroke-linecap="p.strokeLinecap"
      :stroke-linejoin="p.strokeLinejoin"
      :stroke-dasharray="p.strokeDasharray"
      :stroke-opacity="p.strokeOpacity"
      :fill="pathFillRef(p)"
      :fill-opacity="p.fillOpacity"
      :transform="p.transform"
    />
    <g v-if="glistenBand" :clip-path="`url(#${clipId})`">
      <rect
        :x="glistenBand.x"
        :y="glistenBand.y"
        :width="glistenBand.width"
        :height="glistenBand.height"
        :transform="glistenBand.transform"
        :fill="`url(#${glistenGradId})`"
      />
    </g>
    <g v-if="shapeFxActive && activeShapeSparkles.length" :clip-path="`url(#${clipId})`">
      <path
        v-for="s in activeShapeSparkles"
        :key="s.id"
        :d="SHAPE_STAR_D"
        fill="#ffffff"
        :opacity="shapeSparkleOpacity(s)"
        :transform="shapeSparkleTransform(s)"
      />
    </g>
  </svg>
  <div v-else-if="ringStyle" class="profile-border__ring" :style="ringStyle"></div>
</template>

<style scoped>
.profile-border__shape,
.profile-border__conic {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.profile-border__cosmic {
  position: absolute;
  inset: -25%;
  width: 150%;
  height: 150%;
  max-width: none;
  max-height: none;
  pointer-events: none;
}

.profile-border__cosmic-decor {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  pointer-events: none;
}

.pbr-twinkle {
  animation: pbr-twinkle 2.4s ease-in-out infinite;
}

@keyframes pbr-twinkle {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pbr-twinkle {
    animation: none;
  }
}

.profile-border__shape {
  overflow: visible;
}

.profile-border__ring {
  position: absolute;
  inset: 0;
  border-radius: var(--radius-avatar);
  pointer-events: none;
}
</style>
