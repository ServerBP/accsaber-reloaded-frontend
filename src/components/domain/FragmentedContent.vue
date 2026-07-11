<script setup lang="ts">
import type { FragmentSpec } from '@/utils/items'
import { makeRng } from '@/utils/random'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    spec: FragmentSpec
    seed: string
    stack?: number
    measureSelector?: string
    fill?: boolean
    subtle?: boolean
  }>(),
  { stack: 1, fill: true },
)

const containerEl = ref<HTMLElement | null>(null)
const box = ref({ cl: 0, ct: 0, cw: 100, ch: 100, w: 0, h: 0 })
const measured = ref(false)

function measure() {
  const c = containerEl.value
  if (!c) return
  const cr = c.getBoundingClientRect()
  if (!cr.width || !cr.height) return
  const base = c.querySelector('.fragmented-content__base')
  const target = props.measureSelector
    ? base?.querySelector(props.measureSelector)
    : props.fill
      ? c
      : (base?.firstElementChild ?? base)
  const el = (target ?? base) as HTMLElement | null
  const r = el?.getBoundingClientRect()
  if (!r || !r.width || !r.height) return
  box.value = {
    cl: ((r.left - cr.left) / cr.width) * 100,
    ct: ((r.top - cr.top) / cr.height) * 100,
    cw: (r.width / cr.width) * 100,
    ch: (r.height / cr.height) * 100,
    w: cr.width,
    h: cr.height,
  }
  measured.value = true
}

let ro: ResizeObserver | null = null
onMounted(() => {
  void nextTick(measure)
  ro = new ResizeObserver(() => measure())
  if (containerEl.value) ro.observe(containerEl.value)
})
onUnmounted(() => ro?.disconnect())
watch(() => [props.seed, props.stack, props.measureSelector], () => void nextTick(measure))

const TITLE_BAND = 0.5
const TITLE_ROWS = 4
const TITLE_DRIFT = 1.0

type Box = { cl: number; ct: number; cw: number; ch: number; w: number; h: number }

function charRedFilter(cRamp: number): string {
  const br = (0.05 + 0.82 * cRamp).toFixed(2)
  const sat = (2.5 + 5.5 * cRamp).toFixed(2)
  const sep = Math.min(1, 0.45 + cRamp * 0.55).toFixed(2)
  return `grayscale(1) sepia(${sep}) saturate(${sat}) hue-rotate(-30deg) brightness(${br})`
}

function titleFilter(cRamp: number): string {
  const br = (0.32 + 0.6 * cRamp).toFixed(2)
  const sat = (2.5 + 5.5 * cRamp).toFixed(2)
  const sep = Math.min(1, 0.45 + cRamp * 0.55).toFixed(2)
  return `grayscale(1) sepia(${sep}) saturate(${sat}) hue-rotate(-30deg) brightness(${br})`
}

const cornerRadius = computed(() => {
  const b = box.value
  const diag = Math.hypot(b.cw, b.ch)
  return Math.min(diag * 1.05, (props.spec.radiusPct / 100) * diag * (1 + 0.5 * (Math.max(1, props.stack) - 1)))
})

interface Shard {
  key: number
  clip: string
  transform: string
  origin: string
  filter: string
  coverA: number
}

function buildCorner(b: Box): Shard[] {
  const R = cornerRadius.value
  if (R <= 0) return []
  const cornerX = b.cl
  const cornerY = b.ct + b.ch
  const cols = props.spec.cols
  const cell = R / cols
  const pushScale = (b.w || 150) / 150
  const rnd = makeRng(props.seed)
  const out: Shard[] = []
  let key = 0
  for (let gx = 0; gx < cols; gx++) {
    for (let gy = 0; gy < cols; gy++) {
      const lx = gx * cell + cell * 0.5 + (rnd() - 0.5) * cell * 0.45
      const ly = gy * cell + cell * 0.5 + (rnd() - 0.5) * cell * 0.45
      const d = Math.hypot(lx, ly)
      if (d > R || lx > b.cw || ly > b.ch) continue
      const cx = cornerX + lx
      const cy = cornerY - ly
      const t = Math.min(1, d / R)
      const r = cell * 0.5 * (0.82 + rnd() * 0.3)
      const pts: string[] = []
      for (const a of [45, 135, 225, 315]) {
        const rr = r * (0.82 + rnd() * 0.4)
        const aa = ((a + (rnd() * 30 - 15)) * Math.PI) / 180
        pts.push(`${(cx + Math.cos(aa) * rr).toFixed(1)}% ${(cy - Math.sin(aa) * rr).toFixed(1)}%`)
      }
      const len = d || 1
      const push = pushScale * (3 * (1 - t * 0.5) + rnd() * 1.5)
      out.push({
        key: key++,
        clip: `polygon(${pts.join(', ')})`,
        transform: `translate(${((lx / len) * push).toFixed(2)}px, ${((-ly / len) * push).toFixed(2)}px) rotate(${(rnd() * 22 - 11).toFixed(1)}deg)`,
        origin: `${cx.toFixed(1)}% ${cy.toFixed(1)}%`,
        filter: charRedFilter(Math.max(0, Math.min(1, (t - 0.26) / 0.4))),
        coverA: Math.max(0, Math.min(1, 1 - (t - 0.48) / 0.4)),
      })
    }
  }
  return out
}

function buildLeftBand(b: Box): Shard[] {
  const cLeft = (b.cl / 100) * b.w
  const cTop = (b.ct / 100) * b.h
  const cW = (b.cw / 100) * b.w
  const cH = (b.ch / 100) * b.h
  const bandPx = cW * TITLE_BAND
  const tile = cH / TITLE_ROWS
  if (bandPx <= 0 || tile <= 0) return []
  const cols = Math.ceil(bandPx / tile)
  const nRows = Math.ceil(cH / tile)
  const rnd = makeRng(props.seed)
  const X = (px: number) => ((px / b.w) * 100).toFixed(2)
  const Y = (px: number) => ((px / b.h) * 100).toFixed(2)
  const out: Shard[] = []
  let key = 0
  for (let gx = 0; gx < cols; gx++) {
    for (let gy = 0; gy < nRows; gy++) {
      const x0 = cLeft + gx * tile
      const y0 = cTop + gy * tile
      if (x0 - cLeft > bandPx) continue
      const t = Math.min(1, (gx * tile + tile * 0.5) / bandPx)
      const m = tile * 0.14
      const jx = () => (rnd() - 0.5) * tile * 0.28
      const jy = () => (rnd() - 0.5) * tile * 0.28
      const p1x = x0 - m + jx(), p1y = y0 - m + jy()
      const p2x = x0 + tile + m + jx(), p2y = y0 - m + jy()
      const p3x = x0 + tile + m + jx(), p3y = y0 + tile + m + jy()
      const p4x = x0 - m + jx(), p4y = y0 + tile + m + jy()
      const clip = `polygon(${X(p1x)}% ${Y(p1y)}%, ${X(p2x)}% ${Y(p2y)}%, ${X(p3x)}% ${Y(p3y)}%, ${X(p4x)}% ${Y(p4y)}%)`
      const cx = x0 + tile * 0.5
      const cy = y0 + tile * 0.5
      const dr = tile * (0.12 + TITLE_DRIFT * (1 - t))
      const tx = -dr * (0.5 + rnd() * 0.7)
      const ty = (rnd() - 0.5) * dr * 1.3
      const rot = (rnd() - 0.5) * 44 * (1 - t * 0.55)
      out.push({
        key: key++,
        clip,
        transform: `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) rotate(${rot.toFixed(1)}deg)`,
        origin: `${X(cx)}% ${Y(cy)}%`,
        filter: titleFilter(Math.max(0, Math.min(1, (t - 0.02) / 0.55))),
        coverA: t < 0.08 ? Math.max(0, Math.min(1, 0.6 + t * 5)) : 1,
      })
    }
  }
  return out
}

const shards = computed<Shard[]>(() => {
  if (!measured.value) return []
  return props.subtle ? buildLeftBand(box.value) : buildCorner(box.value)
})

const FILL_MASK_PAD = 0.25

const baseMask = computed(() => {
  const b = box.value
  if (!measured.value) return 'none'
  const padX = props.fill ? b.w * FILL_MASK_PAD : 0
  const padY = props.fill ? b.h * FILL_MASK_PAD : 0
  if (props.subtle) {
    const x0 = padX + (b.cl / 100) * b.w
    const bandPx = ((b.cw / 100) * b.w) * TITLE_BAND
    const xSoft = x0 + bandPx * 0.8
    const xEnd = x0 + bandPx
    return `linear-gradient(to right, transparent ${x0.toFixed(0)}px, transparent ${xSoft.toFixed(0)}px, #000 ${xEnd.toFixed(0)}px)`
  }
  const R = cornerRadius.value
  const cxPx = padX + (b.cl / 100) * b.w
  const cyPx = padY + ((b.ct + b.ch) / 100) * b.h
  const rPx = (R / 100) * b.w
  return `radial-gradient(circle at ${cxPx.toFixed(1)}px ${cyPx.toFixed(1)}px, transparent 0%, transparent ${(rPx * 0.72).toFixed(1)}px, #000 ${rPx.toFixed(1)}px)`
})
</script>

<template>
  <span
    ref="containerEl"
    class="fragmented-content"
    :class="{ 'fragmented-content--intrinsic': !fill }"
  >
    <span class="fragmented-content__base" :style="{ '--frag-mask': baseMask }">
      <span class="fragmented-content__base-inner">
        <slot />
      </span>
    </span>
    <span
      v-for="shard in shards"
      :key="shard.key"
      class="fragmented-content__shard"
      :style="{ '--frag-clip': shard.clip, transformOrigin: shard.origin, transform: shard.transform, opacity: shard.coverA }"
      data-fx-static
      aria-hidden="true"
    >
      <span class="fragmented-content__inner" :style="{ filter: shard.filter }">
        <slot />
      </span>
    </span>
  </span>
</template>

<style scoped>
.fragmented-content {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.fragmented-content--intrinsic {
  display: inline-flex;
  width: auto;
  height: auto;
  vertical-align: middle;
}

.fragmented-content__shard,
.fragmented-content__inner,
.fragmented-content__base-inner {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fragmented-content__base {
  position: absolute;
  inset: -25%;
  -webkit-mask-image: var(--frag-mask);
  mask-image: var(--frag-mask);
}

.fragmented-content__base-inner {
  inset: calc(100% / 6);
}

.fragmented-content--intrinsic .fragmented-content__base,
.fragmented-content--intrinsic .fragmented-content__base-inner {
  position: relative;
  inset: auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fragmented-content__shard {
  -webkit-clip-path: var(--frag-clip);
  clip-path: var(--frag-clip);
}

.fragmented-content__shard :deep(*) {
  animation-play-state: paused !important;
  transition: none !important;
}
</style>
