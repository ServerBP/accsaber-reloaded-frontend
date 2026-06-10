<script setup lang="ts">
import type { Composition, ItemModifierRef } from '@/types/api/items'
import { substituteTokens, type TokenContext } from '@/utils/items'
import { computed } from 'vue'

const props = defineProps<{
  modifier: ItemModifierRef | null | undefined
  context?: TokenContext
}>()

const compositions = computed<Composition[]>(() => props.modifier?.effectSpec?.compositions ?? [])
const ctx = computed<TokenContext>(() => props.context ?? {})

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}
function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined
}

interface OutlineProps {
  color: string
  widthPx: number
  glow: boolean
}
function readOutline(c: Composition): OutlineProps {
  return {
    color: asString(c.color) ?? 'currentColor',
    widthPx: asNumber(c.widthPx) ?? 2,
    glow: !!c.glow,
  }
}
function outlineStyle(c: Composition): Record<string, string> {
  const o = readOutline(c)
  const style: Record<string, string> = {
    border: `${o.widthPx}px solid ${o.color}`,
  }
  if (o.glow) style.boxShadow = `0 0 8px ${o.color}, 0 0 16px ${o.color}`
  return style
}

type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | string
function positionClass(prefix: string, p: Position | undefined): string {
  if (!p) return `${prefix}--top-right`
  return `${prefix}--${p}`
}

function readLabel(c: Composition): string | null {
  const direct = asString(c.text)
  if (direct) return direct
  const expr = asString(c.textExpr)
  if (!expr) return null
  if (/^#?\$\{serial\}$/.test(expr.trim())) return null
  return substituteTokens(expr, ctx.value)
}

function readStatLabel(c: Composition): string | null {
  const key = asString(c.statKey) ?? ''
  if (key === 'serial') return null
  const prefix = asString(c.prefix) ?? ''
  const stats = ctx.value.stats ?? {}
  const raw = stats[key]
  const value = raw == null ? 0 : raw
  return `${prefix}${value}`
}

function labelStyle(c: Composition): Record<string, string> {
  const style: Record<string, string> = {}
  const bg = asString(c.background)
  const color = asString(c.color)
  const fw = asNumber(c.fontWeight)
  if (bg) style.background = bg
  if (color) style.color = color
  if (fw) style.fontWeight = String(fw)
  return style
}

const FILTER_CSS: Record<string, (amount: number) => string> = {
  sepia: (a) => `sepia(${a})`,
  saturate: (a) => `saturate(${a})`,
  desaturate: (a) => `saturate(${1 - a})`,
  noise_overlay: () => '',
}
function filterStyle(c: Composition): Record<string, string> {
  const filterType = asString(c.filterType) ?? ''
  const amount = asNumber(c.amount) ?? 1
  const fn = FILTER_CSS[filterType]
  const style: Record<string, string> = {}
  if (fn) {
    const expr = fn(amount)
    if (expr) {
      style.backdropFilter = expr
      style.webkitBackdropFilter = expr
    }
  }
  if (filterType === 'noise_overlay') {
    style.background = `url("data:image/svg+xml;utf8,${encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2"/></filter><rect width="80" height="80" filter="url(#n)" opacity="0.3"/></svg>',
    )}")`
    style.opacity = String(amount)
    style.mixBlendMode = 'overlay'
  }
  return style
}

const PASTEL_RAINBOW = [
  '#ffb3d9',
  '#ffd1a8',
  '#fff2a8',
  '#b8f5c9',
  '#b3e1ff',
  '#d4baff',
]

interface Sparkle {
  x: number
  y: number
  size: number
  color: string
  delay: number
  duration: number
}

function makeSparkles(c: Composition): Sparkle[] {
  const density = Math.max(0.4, Math.min(1.6, asNumber(c.density) ?? 1))
  const count = Math.round(8 * density)
  const speedHz = asNumber(c.speedHz) ?? 0.6
  const baseDuration = 1 / Math.max(speedHz, 0.05)
  const out: Sparkle[] = []
  for (let i = 0; i < count; i++) {
    out.push({
      x: 8 + ((i * 53) % 84),
      y: 8 + ((i * 89) % 84),
      size: 5 + ((i * 3) % 4),
      color: PASTEL_RAINBOW[i % PASTEL_RAINBOW.length],
      delay: (i * 0.31) % baseDuration,
      duration: baseDuration + (i % 3) * 0.4,
    })
  }
  return out
}

interface Particle {
  x: number
  y: number
  delay: number
  duration: number
  size: number
}
function makeParticles(c: Composition): Particle[] {
  const rate = asNumber(c.ratePerSec) ?? 4
  const count = Math.max(3, Math.min(12, Math.round(rate * 2)))
  const out: Particle[] = []
  for (let i = 0; i < count; i++) {
    out.push({
      x: 10 + (i * 73) % 80,
      y: 10 + (i * 47) % 80,
      delay: (i * 0.37) % 2.4,
      duration: 1.8 + (i % 4) * 0.5,
      size: 3 + (i % 3),
    })
  }
  return out
}
function particleColor(c: Composition): string {
  return asString(c.color) ?? 'var(--accent, #ffffff)'
}

</script>

<template>
  <div v-if="compositions.length" class="modifier-overlay" aria-hidden="true">
    <template v-for="(c, i) in compositions" :key="i">
      <div
        v-if="c.type === 'border_outline'"
        class="comp-border-outline"
        :style="outlineStyle(c)"
      ></div>

      <div
        v-else-if="c.type === 'label_overlay' && readLabel(c) != null"
        class="comp-label"
        :class="positionClass('comp-label', c.position as Position | undefined)"
        :style="labelStyle(c)"
      >{{ readLabel(c) }}</div>

      <div
        v-else-if="c.type === 'stat_counter' && readStatLabel(c) != null"
        class="comp-stat-counter"
        :class="positionClass('comp-stat-counter', c.position as Position | undefined)"
        :style="labelStyle(c)"
      >{{ readStatLabel(c) }}</div>

      <div
        v-else-if="c.type === 'filter'"
        class="comp-filter"
        :style="filterStyle(c)"
      ></div>

      <div
        v-else-if="c.type === 'shader_overlay'"
        class="comp-sparkles"
        aria-hidden="true"
      >
        <span
          v-for="(s, j) in makeSparkles(c)"
          :key="j"
          class="comp-sparkle"
          :style="{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            background: s.color,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }"
        ></span>
      </div>

      <div
        v-else-if="c.type === 'particle'"
        class="comp-particles"
      >
        <span
          v-for="(p, j) in makeParticles(c)"
          :key="j"
          class="comp-particle"
          :style="{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: particleColor(c),
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }"
        ></span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.modifier-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  border-radius: inherit;
}

.comp-border-outline {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
}

.comp-label,
.comp-stat-counter {
  position: absolute;
  padding: 2px 6px;
  font-family: var(--font-sans);
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  background: rgba(0, 0, 0, 0.7);
  color: var(--text-primary);
  border-radius: 3px;
  white-space: nowrap;
}

.comp-stat-counter {
  font-family: var(--font-mono);
}

.comp-label--top-left,
.comp-stat-counter--top-left { top: 4px; left: 4px; }
.comp-label--top-right,
.comp-stat-counter--top-right { top: 4px; right: 4px; }
.comp-label--bottom-left,
.comp-stat-counter--bottom-left { bottom: 4px; left: 4px; }
.comp-label--bottom-right,
.comp-stat-counter--bottom-right { bottom: 4px; right: 4px; }
.comp-label--center,
.comp-stat-counter--center { top: 50%; left: 50%; transform: translate(-50%, -50%); }

.comp-filter {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.comp-sparkles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.comp-sparkle {
  position: absolute;
  transform: translate(-50%, -50%) scale(0);
  border-radius: 1px;
  clip-path: polygon(
    50% 0%, 58% 42%, 100% 50%, 58% 58%,
    50% 100%, 42% 58%, 0% 50%, 42% 42%
  );
  opacity: 0;
  animation: comp-sparkle-twinkle 2.2s ease-in-out infinite;
}

.comp-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.comp-particle {
  position: absolute;
  border-radius: 50%;
  opacity: 0;
  animation: comp-particle-float 2s ease-out infinite;
}

@keyframes comp-particle-float {
  0%   { transform: translateY(0) scale(0.4); opacity: 0; }
  20%  { opacity: 0.8; }
  100% { transform: translateY(-30px) scale(1); opacity: 0; }
}

@keyframes comp-sparkle-twinkle {
  0%, 100% { transform: translate(-50%, -50%) scale(0) rotate(0deg); opacity: 0; }
  40%      { transform: translate(-50%, -50%) scale(1) rotate(45deg); opacity: 1; }
  70%      { transform: translate(-50%, -50%) scale(0.6) rotate(90deg); opacity: 0.6; }
}

@media (prefers-reduced-motion: reduce) {
  .comp-particle,
  .comp-sparkle {
    animation: none;
  }
}
</style>
