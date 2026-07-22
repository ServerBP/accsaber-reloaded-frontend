<script setup lang="ts">
import type { Composition } from '@/types/api/items'
import type { TokenContext } from '@/utils/items'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { asNumber, asString, type ContentBox, type EffectMeasure } from './shared'

const props = defineProps<{
  composition: Composition
  ctx: TokenContext
  measure: EffectMeasure
}>()

const root = ref<HTMLElement | null>(null)
const titleText = ref('')
const titleFont = ref<Record<string, string> | null>(null)
const titleBox = ref<ContentBox | null>(null)

const isTitle = computed(() => !!titleText.value)
const isField = computed(() => asString(props.composition.spread) === 'field')

const intensity = computed(() =>
  Math.max(0.15, Math.min(1, asNumber(props.composition.intensity) ?? 0.5)),
)
const angleDeg = computed(() => asNumber(props.composition.angleDeg) ?? 115)
const sweepMs = computed(() => Math.max(1200, asNumber(props.composition.sweepMs) ?? 6500))

const CONTENT_RADIUS: Record<string, string> = {
  profile_border_color: 'var(--radius-avatar)',
  theme: '6px',
}

const contentBoxStyle = computed<Record<string, string>>(() => {
  const none: Record<string, string> = {}
  if (isField.value || isTitle.value) return none
  const b = props.measure.box
  const o = props.measure.overlayBox
  if (!b.w || !b.h || !o.w || !o.h) return none
  if (b.w >= o.w - 1 && b.h >= o.h - 1) return none
  return {
    inset: 'auto',
    left: `${b.x}px`,
    top: `${b.y}px`,
    width: `${b.w}px`,
    height: `${b.h}px`,
    borderRadius: CONTENT_RADIUS[props.measure.typeKey ?? ''] ?? '4px',
  }
})

const rootStyle = computed<Record<string, string>>(() => ({
  '--holo-angle': `${angleDeg.value}deg`,
  '--holo-sweep': `${sweepMs.value}ms`,
  '--holo-op': String(0.5 + intensity.value * 0.4),
  '--holo-base': String(0.42 + intensity.value * 0.44),
  ...contentBoxStyle.value,
}))

const fieldHoverEnabled =
  typeof window !== 'undefined' &&
  window.matchMedia('(hover: hover)').matches &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches

const GLOSS_SIZE = 320
const glossEl = ref<HTMLElement | null>(null)
let fieldRaf = 0
let fieldX = 0
let fieldY = 0
let fieldIdleTimer: ReturnType<typeof setTimeout> | undefined

function applyFieldPointer() {
  fieldRaf = 0
  const gloss = glossEl.value
  if (!gloss || !window.innerWidth || !window.innerHeight) return
  gloss.style.transform = `translate(${fieldX - GLOSS_SIZE / 2}px, ${fieldY - GLOSS_SIZE / 2}px)`
  gloss.style.setProperty('--holo-mx', (fieldX / window.innerWidth).toFixed(3))
  gloss.style.setProperty('--holo-my', (fieldY / window.innerHeight).toFixed(3))
  gloss.classList.add('is-on')
  if (fieldIdleTimer) clearTimeout(fieldIdleTimer)
  fieldIdleTimer = setTimeout(() => glossEl.value?.classList.remove('is-on'), 150)
}

function onFieldMove(e: PointerEvent) {
  fieldX = e.clientX
  fieldY = e.clientY
  if (!fieldRaf) fieldRaf = requestAnimationFrame(applyFieldPointer)
}

const titleStyle = computed<Record<string, string>>(() => {
  const out: Record<string, string> = { ...(titleFont.value ?? {}) }
  const b = titleBox.value
  if (b) {
    out.left = `${b.x}%`
    out.top = `${b.y}%`
  }
  return out
})

let host: HTMLElement | null = null
let overlay: HTMLElement | null = null
let textEl: HTMLElement | null = null
let ro: ResizeObserver | null = null
let settleTimer: ReturnType<typeof setTimeout> | undefined
let raf = 0
let pendingX = 0.5
let pendingY = 0.5

function remeasure() {
  if (!overlay || !textEl) return
  const o = overlay.getBoundingClientRect()
  const t = textEl.getBoundingClientRect()
  if (!o.width || !o.height || !t.width || !t.height) return
  titleBox.value = {
    x: ((t.left - o.left) / o.width) * 100,
    y: ((t.top - o.top) / o.height) * 100,
    w: (t.width / o.width) * 100,
    h: (t.height / o.height) * 100,
  }
}

function applyPointer() {
  raf = 0
  const el = root.value
  if (!el) return
  el.style.setProperty('--holo-mx', pendingX.toFixed(3))
  el.style.setProperty('--holo-my', pendingY.toFixed(3))
}

function onMove(e: PointerEvent) {
  const el = root.value
  if (!el) return
  const r = el.getBoundingClientRect()
  if (!r.width || !r.height) return
  pendingX = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
  pendingY = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))
  if (!raf) raf = requestAnimationFrame(applyPointer)
}

function onEnter() {
  const el = root.value
  if (!el) return
  el.classList.add('is-hover')
  el.style.setProperty('--holo-active', '1')
}

function onLeave() {
  const el = root.value
  if (!el) return
  el.classList.remove('is-hover')
  el.style.setProperty('--holo-active', '0')
  el.style.setProperty('--holo-mx', '0.5')
  el.style.setProperty('--holo-my', '0.5')
}

onMounted(() => {
  if (isField.value) {
    if (fieldHoverEnabled) {
      window.addEventListener('pointermove', onFieldMove, { passive: true })
    }
    return
  }
  const el = root.value
  if (!el) return
  overlay = el.closest<HTMLElement>('.modifier-overlay')
  host = overlay?.parentElement ?? null
  el.style.setProperty('--holo-active', '0')
  el.style.setProperty('--holo-mx', '0.5')
  el.style.setProperty('--holo-my', '0.5')

  textEl = host?.querySelector<HTMLElement>('.title-renderer__text') ?? null
  if (textEl) {
    titleText.value = textEl.textContent ?? ''
    const cs = getComputedStyle(textEl)
    titleFont.value = {
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      fontStyle: cs.fontStyle,
      letterSpacing: cs.letterSpacing,
      textTransform: cs.textTransform,
      lineHeight: cs.lineHeight,
    }
    ro = new ResizeObserver(remeasure)
    ro.observe(textEl)
    if (overlay) ro.observe(overlay)
    remeasure()
    settleTimer = setTimeout(remeasure, 420)
  }

  if (host && window.matchMedia('(hover: hover)').matches) {
    host.addEventListener('pointerenter', onEnter)
    host.addEventListener('pointerleave', onLeave)
    host.addEventListener('pointermove', onMove)
  }
})

onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf)
  if (fieldRaf) cancelAnimationFrame(fieldRaf)
  if (fieldIdleTimer) clearTimeout(fieldIdleTimer)
  if (settleTimer) clearTimeout(settleTimer)
  ro?.disconnect()
  window.removeEventListener('pointermove', onFieldMove)
  if (host) {
    host.removeEventListener('pointerenter', onEnter)
    host.removeEventListener('pointerleave', onLeave)
    host.removeEventListener('pointermove', onMove)
  }
})
</script>

<template>
  <div ref="root" class="comp-holo" :style="rootStyle" aria-hidden="true">
    <template v-if="isField">
      <div class="comp-holo__fieldshine"></div>
      <div v-if="fieldHoverEnabled" ref="glossEl" class="comp-holo__gloss"></div>
    </template>
    <span v-else-if="isTitle" class="comp-holo__text" :style="titleStyle">{{ titleText }}</span>
    <template v-else>
      <div class="comp-holo__shine"></div>
      <div class="comp-holo__shine comp-holo__shine--lift"></div>
    </template>
  </div>
</template>

<style scoped>
.comp-holo {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  border-radius: inherit;
}

.comp-holo__shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    var(--holo-angle, 115deg),
    transparent 38%,
    rgba(255, 95, 130, 0.42) 44%,
    rgba(255, 235, 140, 0.42) 47%,
    rgba(255, 255, 255, 0.85) 50%,
    rgba(130, 240, 185, 0.42) 53%,
    rgba(120, 195, 255, 0.42) 56%,
    transparent 62%
  );
  background-size: 220% 220%;
  background-repeat: no-repeat;
  mix-blend-mode: overlay;
  opacity: calc(var(--holo-op, 0.7) + var(--holo-active, 0) * 0.3);
  animation: comp-holo-sweep var(--holo-sweep, 6500ms) ease-in-out infinite;
  transition: opacity 180ms ease;
}

.comp-holo__text {
  position: absolute;
  white-space: nowrap;
  color: transparent;
  -webkit-text-fill-color: transparent;
  background:
    linear-gradient(
      var(--holo-angle, 115deg),
      transparent 38%,
      rgba(255, 105, 145, 0.75) 45%,
      rgba(255, 240, 175, 0.9) 48%,
      rgba(255, 255, 255, 1) 50%,
      rgba(150, 250, 205, 0.9) 52%,
      rgba(135, 205, 255, 0.75) 55%,
      transparent 62%
    ),
    linear-gradient(
      var(--holo-angle, 115deg),
      rgba(255, 120, 200, var(--holo-base, 0.6)),
      rgba(255, 225, 150, var(--holo-base, 0.6)) 22%,
      rgba(150, 245, 205, var(--holo-base, 0.6)) 46%,
      rgba(140, 205, 255, var(--holo-base, 0.6)) 70%,
      rgba(210, 160, 255, var(--holo-base, 0.6)) 100%
    );
  background-size: 300% 100%, 100% 100%;
  background-repeat: no-repeat, no-repeat;
  -webkit-background-clip: text;
  background-clip: text;
  mix-blend-mode: screen;
  opacity: calc(0.85 + var(--holo-active, 0) * 0.15);
  animation: comp-holo-textsweep calc(var(--holo-sweep, 6500ms) * 0.5) linear infinite;
  transition: opacity 180ms ease;
}

.comp-holo__shine--lift {
  mix-blend-mode: screen;
  opacity: calc((var(--holo-op, 0.7) + var(--holo-active, 0) * 0.3) * 0.45);
}

.comp-holo__fieldshine {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    var(--holo-angle, 115deg),
    transparent 38%,
    rgba(255, 95, 130, 0.42) 44%,
    rgba(255, 235, 140, 0.42) 47%,
    rgba(255, 255, 255, 0.85) 50%,
    rgba(130, 240, 185, 0.42) 53%,
    rgba(120, 195, 255, 0.42) 56%,
    transparent 62%
  );
  background-size: 220% 220%;
  background-repeat: no-repeat;
  mix-blend-mode: screen;
  opacity: calc(var(--holo-op, 0.7) * 0.07);
  animation: comp-holo-sweep calc(var(--holo-sweep, 6500ms) * 2.2) ease-in-out infinite;
}

.comp-holo__gloss {
  position: absolute;
  inset: auto;
  left: 0;
  top: 0;
  width: 320px;
  height: 320px;
  pointer-events: none;
  background: linear-gradient(
    var(--holo-angle, 115deg),
    transparent 30%,
    rgba(255, 95, 130, 0.35) 40%,
    rgba(255, 235, 140, 0.35) 45%,
    rgba(255, 255, 255, 0.6) 50%,
    rgba(130, 240, 185, 0.35) 55%,
    rgba(120, 195, 255, 0.35) 60%,
    transparent 70%
  );
  background-size: 250% 250%;
  background-repeat: no-repeat;
  background-position: calc(var(--holo-mx, 0.5) * 100%) calc(var(--holo-my, 0.5) * 100%);
  mask-image: radial-gradient(circle, #000 20%, transparent 68%);
  -webkit-mask-image: radial-gradient(circle, #000 20%, transparent 68%);
  mix-blend-mode: screen;
  opacity: 0;
  transition: opacity 650ms ease-out;
}

.comp-holo__gloss.is-on {
  opacity: calc(var(--holo-op, 0.7) * 0.5);
  transition: opacity 250ms ease-out;
}

.comp-holo.is-hover .comp-holo__shine {
  animation: none;
  background-position: calc(var(--holo-mx, 0.5) * 100%) calc(var(--holo-my, 0.5) * 100%);
}

.comp-holo.is-hover .comp-holo__text {
  animation: none;
  background-position: calc(var(--holo-mx, 0.5) * 100%) 0, 0% 0;
}

@keyframes comp-holo-sweep {
  0% {
    background-position: 0% 0%;
  }
  35% {
    background-position: 100% 100%;
  }
  100% {
    background-position: 100% 100%;
  }
}

@keyframes comp-holo-textsweep {
  from {
    background-position: 0% 0, 0% 0;
  }
  to {
    background-position: 100% 0, 0% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .comp-holo__shine,
  .comp-holo__text,
  .comp-holo__fieldshine {
    animation: none;
  }

  .comp-holo__fieldshine {
    background-position: 50% 50%;
  }

  .comp-holo__shine {
    background-position: 50% 50%;
  }

  .comp-holo__text {
    background-position: 50% 0, 0% 0;
  }
}
</style>
