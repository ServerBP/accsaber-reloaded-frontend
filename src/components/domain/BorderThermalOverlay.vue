<script setup lang="ts">
import { useReducedMotion } from '@/composables/useReducedMotion'
import type { BorderColorValue, BorderThermalOverlaySpec, ThermalPalette } from '@/types/api/items'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  overlay: BorderThermalOverlaySpec
  avatarUrl?: string | null
  color?: BorderColorValue | null
}>()

interface PaletteDef {
  r: number[]
  g: number[]
  b: number[]
  hud: string
  readout: string
}

const PALETTES: Record<ThermalPalette, PaletteDef> = {
  ironbow: {
    r: [0, 0.05, 0.25, 0.55, 0.85, 1, 1, 1],
    g: [0, 0, 0.03, 0.08, 0.22, 0.45, 0.75, 1],
    b: [0.06, 0.3, 0.5, 0.45, 0.25, 0.08, 0.1, 1],
    hud: '#ff9d2e',
    readout: '#ffd898',
  },
  whitehot: {
    r: [0, 0.08, 0.2, 0.38, 0.58, 0.78, 0.92, 1],
    g: [0, 0.08, 0.2, 0.38, 0.58, 0.78, 0.92, 1],
    b: [0.04, 0.12, 0.24, 0.4, 0.6, 0.79, 0.93, 1],
    hud: '#e8ecf4',
    readout: '#f2f4fa',
  },
  nightvision: {
    r: [0, 0, 0.02, 0.05, 0.1, 0.2, 0.45, 0.85],
    g: [0, 0.08, 0.2, 0.38, 0.6, 0.8, 0.95, 1],
    b: [0, 0.02, 0.05, 0.08, 0.12, 0.2, 0.4, 0.75],
    hud: '#86f596',
    readout: '#c8ffd0',
  },
}

const BLADE_BG = '#0b0b10'
const LED_DEFAULT = '#ff3b30'
const CHARGE_MS = 550
const SHUT_MS = 160
const OPEN_MS = 240
const STATIC_FPS_MS = 130
const READOUT_MS = 260
const BRACKETS_D = 'M14,24 L14,14 L24,14 M76,14 L86,14 L86,24 M86,76 L86,86 L76,86 M24,86 L14,86 L14,76'

let uidCounter = 0
const uid = `bto-${++uidCounter}-${Math.random().toString(36).slice(2, 8)}`

const palette = computed(() => PALETTES[props.overlay.palette ?? 'ironbow'] ?? PALETTES.ironbow)
const hudColor = computed(() => props.overlay.hud ?? palette.value.hud)
const ledColor = computed(() => props.overlay.led ?? LED_DEFAULT)
const win = computed(() => props.overlay.window ?? { x: 10, y: 10, w: 80, h: 80 })

const bracketColor = computed(() => {
  const fill = props.color?.states?.[0]?.fill
  if (!fill) return '#e6e4ee'
  if (fill.type === 'solid') return fill.hex
  if (fill.type === 'linear' || fill.type === 'radial' || fill.type === 'conic') {
    return fill.stops[0]?.hex ?? '#e6e4ee'
  }
  if (fill.type === 'pixel_metal') return fill.highlight
  if (fill.type === 'cosmic') return fill.star
  if (fill.type === 'toon') return fill.line
  return '#e6e4ee'
})

const bladesClosed = ref(false)
const bladesOpening = ref(false)
const thermalOn = ref(false)
const hudOn = ref(false)
const ledOpacity = ref(0.55)
const readoutText = ref('IR --.-°')
const reducedMotion = useReducedMotion()

const styleVars = computed(() => ({
  '--bto-hud': hudColor.value,
  '--bto-readout': palette.value.readout,
  '--bto-blade': BLADE_BG,
}))

const windowStyle = computed(() => ({
  left: `${win.value.x}%`,
  top: `${win.value.y}%`,
  width: `${win.value.w}%`,
  height: `${win.value.h}%`,
}))

const grainStyle = {
  background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 3px)',
}

let visibilityHandler: (() => void) | null = null
let timers: ReturnType<typeof setTimeout>[] = []
let intervals: ReturnType<typeof setInterval>[] = []
let cycleTimer: ReturnType<typeof setInterval> | null = null
const staticCanvas = ref<HTMLCanvasElement | null>(null)

function after(ms: number, fn: () => void) {
  timers.push(setTimeout(fn, ms))
}

function every(ms: number, fn: () => void) {
  const t = setInterval(fn, ms)
  intervals.push(t)
  return t
}

function clearPhaseTimers() {
  for (const t of timers) clearTimeout(t)
  timers = []
  clearPhaseIntervals()
}

function clearPhaseIntervals() {
  for (const t of intervals) clearInterval(t)
  intervals = []
}

function toRest() {
  bladesClosed.value = false
  bladesOpening.value = false
  thermalOn.value = false
  hudOn.value = false
  ledOpacity.value = 0.55
}

function drawStatic() {
  const canvas = staticCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const cells = 26
  if (canvas.width !== cells) {
    canvas.width = cells
    canvas.height = cells
  }
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const v = Math.floor(Math.random() * 105)
      ctx.fillStyle = `rgb(${v},${v},${v})`
      ctx.fillRect(x, y, 1, 1)
    }
  }
}

function blinkLed(times: number, gap: number) {
  let i = 0
  const t = every(gap, () => {
    ledOpacity.value = i % 2 ? 1 : 0.25
    if (++i >= times * 2) {
      clearInterval(t)
      ledOpacity.value = 1
    }
  })
}

function runCycle() {
  clearPhaseTimers()
  const hold = props.overlay.holdMs ?? 2300
  blinkLed(3, 90)
  after(CHARGE_MS, () => {
    bladesOpening.value = false
    bladesClosed.value = true
  })
  after(CHARGE_MS + SHUT_MS + 40, () => {
    thermalOn.value = true
    if (!props.avatarUrl) drawStatic()
  })
  after(CHARGE_MS + SHUT_MS + 90, () => {
    bladesOpening.value = true
    bladesClosed.value = false
    hudOn.value = true
    if (props.avatarUrl) {
      every(READOUT_MS, () => {
        readoutText.value = `IR ${(35.5 + Math.random() * 2.4).toFixed(1)}°`
      })
    } else {
      readoutText.value = 'IR --.-°'
      every(STATIC_FPS_MS, drawStatic)
    }
  })
  const closeAt = CHARGE_MS + SHUT_MS + 90 + OPEN_MS + hold
  after(closeAt, () => {
    bladesOpening.value = false
    bladesClosed.value = true
  })
  after(closeAt + SHUT_MS + 40, () => {
    clearPhaseIntervals()
    thermalOn.value = false
    hudOn.value = false
    ledOpacity.value = 0.55
  })
  after(closeAt + SHUT_MS + 90, () => {
    bladesOpening.value = true
    bladesClosed.value = false
  })
}

function schedule() {
  stop()
  if (reducedMotion.value) return
  if (typeof document !== 'undefined' && document.hidden) return
  const interval = Math.max(3000, props.overlay.intervalMs ?? 7400)
  cycleTimer = setInterval(runCycle, interval)
  timers.push(setTimeout(runCycle, 1200))
}

function stop() {
  if (cycleTimer) {
    clearInterval(cycleTimer)
    cycleTimer = null
  }
  clearPhaseTimers()
  toRest()
}

onMounted(() => {
  visibilityHandler = () => schedule()
  document.addEventListener('visibilitychange', visibilityHandler)
  schedule()
})

watch(reducedMotion, schedule)

onUnmounted(() => {
  stop()
  if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler)
})

watch(() => props.overlay, () => schedule(), { deep: true })
</script>

<template>
  <div class="border-thermal-overlay" :style="styleVars" aria-hidden="true">
    <div class="bto-stack">
      <div class="bto-window" :style="windowStyle">
        <div class="bto-map" :class="{ 'bto-map--on': thermalOn }">
          <img
            v-if="avatarUrl"
            class="bto-map__img"
            :src="avatarUrl"
            :style="{ filter: `url(#${uid}-ramp)` }"
            alt=""
          />
          <canvas
            v-else
            ref="staticCanvas"
            class="bto-map__img"
            :style="{ filter: `url(#${uid}-ramp)` }"
          />
          <div class="bto-grain" :class="{ 'bto-grain--on': hudOn }" :style="grainStyle" />
          <div class="bto-scanline" :class="{ 'bto-scanline--on': hudOn }" />
        </div>
        <div
          class="bto-blade bto-blade--top"
          :class="{ 'bto-blade--closed': bladesClosed, 'bto-blade--opening': bladesOpening }"
        />
        <div
          class="bto-blade bto-blade--bot"
          :class="{ 'bto-blade--closed': bladesClosed, 'bto-blade--opening': bladesOpening }"
        />
      </div>
      <svg class="bto-chrome" viewBox="0 0 100 100">
        <defs>
          <filter :id="`${uid}-ramp`" color-interpolation-filters="sRGB">
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncR type="gamma" amplitude="1" exponent="0.8" offset="0" />
              <feFuncG type="gamma" amplitude="1" exponent="0.8" offset="0" />
              <feFuncB type="gamma" amplitude="1" exponent="0.8" offset="0" />
            </feComponentTransfer>
            <feComponentTransfer>
              <feFuncR type="table" :tableValues="palette.r.join(' ')" />
              <feFuncG type="table" :tableValues="palette.g.join(' ')" />
              <feFuncB type="table" :tableValues="palette.b.join(' ')" />
            </feComponentTransfer>
          </filter>
        </defs>
        <path
          class="bto-brackets"
          :d="BRACKETS_D"
          fill="none"
          :stroke="hudOn ? hudColor : bracketColor"
          stroke-width="2"
          stroke-linecap="square"
        />
        <circle cx="85.1" cy="4" r="1.4" :fill="ledColor" :fill-opacity="ledOpacity" class="bto-led" />
        <g v-if="hudOn" class="bto-reticle">
          <path d="M50,26 L50,40 M50,60 L50,74 M26,50 L40,50 M60,50 L74,50" fill="none" stroke-width="1" stroke-opacity="0.85" />
          <circle cx="50" cy="50" r="4" fill="none" stroke-width="1" stroke-opacity="0.85" />
          <circle cx="50" cy="50" r="0.9" class="bto-reticle__dot" stroke="none" />
          <text x="13" y="96.5" class="bto-readout">{{ readoutText }}</text>
        </g>
      </svg>
    </div>
  </div>
</template>

<style scoped>
.border-thermal-overlay {
  position: absolute;
  inset: -20%;
  width: 140%;
  height: 140%;
  max-width: none;
  max-height: none;
  pointer-events: none;
}

.bto-stack {
  position: absolute;
  inset: 14.2857%;
}

.bto-chrome {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.bto-brackets {
  stroke-opacity: 0.9;
  transition: stroke 200ms ease-out;
}

.bto-reticle path,
.bto-reticle circle {
  stroke: var(--bto-hud);
}

.bto-reticle__dot {
  fill: var(--bto-readout);
}

.bto-readout {
  font-family: 'Consolas', 'Menlo', monospace;
  font-size: 4.6px;
  font-weight: 600;
  letter-spacing: 0.06em;
  fill: var(--bto-readout);
  stroke: var(--bto-blade);
  stroke-width: 0.55px;
  stroke-opacity: 0.85;
  paint-order: stroke;
}

.bto-window {
  position: absolute;
  overflow: hidden;
}

.bto-map {
  position: absolute;
  inset: 0;
  opacity: 0;
}

.bto-map--on {
  opacity: 1;
}

.bto-map__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  image-rendering: auto;
}

canvas.bto-map__img {
  image-rendering: pixelated;
}

.bto-grain {
  position: absolute;
  inset: 0;
  mix-blend-mode: overlay;
  opacity: 0;
}

.bto-grain--on {
  opacity: 1;
  animation: bto-flick 320ms steps(2) infinite;
}

@keyframes bto-flick {
  50% {
    opacity: 0.45;
  }
}

.bto-scanline {
  position: absolute;
  left: 0;
  right: 0;
  top: -3%;
  height: 2px;
  background: var(--bto-readout);
  opacity: 0;
}

.bto-scanline--on {
  opacity: 0.5;
  animation: bto-sweep 1.3s linear 1 forwards;
}

@keyframes bto-sweep {
  from {
    top: -3%;
  }
  to {
    top: 103%;
  }
}

.bto-blade {
  position: absolute;
  left: 0;
  right: 0;
  height: 51%;
  background: var(--bto-blade);
  transition: transform 160ms cubic-bezier(0.55, 0, 0.85, 0.36);
}

.bto-blade--top {
  top: 0;
  transform: translateY(-102%);
  border-bottom: 1px solid var(--bto-hud);
}

.bto-blade--bot {
  bottom: 0;
  transform: translateY(102%);
  border-top: 1px solid var(--bto-hud);
}

.bto-blade--closed {
  transform: translateY(0);
}

.bto-blade--opening {
  transition: transform 240ms cubic-bezier(0.16, 0.84, 0.34, 1);
}

@media (prefers-reduced-motion: reduce) {
  .bto-grain--on,
  .bto-scanline--on {
    animation: none;
  }
}
</style>
