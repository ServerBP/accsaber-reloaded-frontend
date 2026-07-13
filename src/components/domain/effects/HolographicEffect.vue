<script setup lang="ts">
import type { Composition } from '@/types/api/items'
import type { TokenContext } from '@/utils/items'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { asNumber, type ContentBox, type EffectMeasure } from './shared'

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

const intensity = computed(() =>
  Math.max(0.15, Math.min(1, asNumber(props.composition.intensity) ?? 0.5)),
)
const angleDeg = computed(() => asNumber(props.composition.angleDeg) ?? 115)
const sweepMs = computed(() => Math.max(1200, asNumber(props.composition.sweepMs) ?? 6500))

const rootStyle = computed<Record<string, string>>(() => ({
  '--holo-angle': `${angleDeg.value}deg`,
  '--holo-sweep': `${sweepMs.value}ms`,
  '--holo-op': String(0.5 + intensity.value * 0.4),
}))

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
  if (settleTimer) clearTimeout(settleTimer)
  ro?.disconnect()
  if (host) {
    host.removeEventListener('pointerenter', onEnter)
    host.removeEventListener('pointerleave', onLeave)
    host.removeEventListener('pointermove', onMove)
  }
})
</script>

<template>
  <div ref="root" class="comp-holo" :style="rootStyle" aria-hidden="true">
    <span v-if="isTitle" class="comp-holo__text" :style="titleStyle">{{ titleText }}</span>
    <div v-else class="comp-holo__shine"></div>
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
      transparent 40%,
      rgba(255, 95, 130, 0.5) 45%,
      rgba(255, 235, 140, 0.5) 48%,
      rgba(255, 255, 255, 1) 50%,
      rgba(130, 240, 185, 0.5) 52%,
      rgba(120, 195, 255, 0.5) 55%,
      transparent 60%
    ),
    linear-gradient(
      var(--holo-angle, 115deg),
      rgba(255, 140, 205, 0.42),
      rgba(150, 225, 255, 0.42),
      rgba(205, 165, 255, 0.42)
    );
  background-size: 300% 100%, 100% 100%;
  background-repeat: no-repeat, no-repeat;
  -webkit-background-clip: text;
  background-clip: text;
  mix-blend-mode: screen;
  opacity: calc(0.75 + var(--holo-active, 0) * 0.25);
  animation: comp-holo-textsweep var(--holo-sweep, 6500ms) ease-in-out infinite;
  transition: opacity 180ms ease;
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
  0% {
    background-position: 0% 0, 0% 0;
  }
  35% {
    background-position: 100% 0, 0% 0;
  }
  100% {
    background-position: 100% 0, 0% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .comp-holo__shine,
  .comp-holo__text {
    animation: none;
  }

  .comp-holo__shine {
    background-position: 50% 50%;
  }
}
</style>
