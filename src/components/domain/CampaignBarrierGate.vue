<script setup lang="ts">
import { computed } from 'vue'

type GateState = 'plain' | 'locked' | 'blocking' | 'open'

const props = withDefaults(
  defineProps<{
    x1: number
    y1: number
    x2: number
    y2: number
    readoutText: string
    accentColor?: string
    state?: GateState
    selected?: boolean
    unit?: number
  }>(),
  {
    accentColor: 'var(--warning)',
    state: 'plain',
    selected: false,
    unit: 48,
  },
)

const thickness = computed(() => Math.max(props.unit * 0.075, 3.5))

const dotR = computed(() => thickness.value * 1.05)

const strokeColor = computed(() => (props.state === 'open' ? 'var(--success)' : props.accentColor))

const opacity = computed(() => (props.state === 'locked' ? 0.45 : 1))

const geom = computed(() => {
  const wdx = props.x2 - props.x1
  const wdy = props.y2 - props.y1
  const len = Math.hypot(wdx, wdy) || 1
  const ux = wdx / len
  const uy = wdy / len
  return { ux, uy, px: -uy, py: ux, len, mx: (props.x1 + props.x2) / 2, my: (props.y1 + props.y2) / 2 }
})

const shatter = computed(() => {
  const g = geom.value
  const gap = g.len * 0.13
  const shear = thickness.value * 1.15
  const sl = Math.max(g.len * 0.09, props.unit * 0.14)
  const a2x = g.mx - g.ux * gap + g.px * shear
  const a2y = g.my - g.uy * gap + g.py * shear
  const b1x = g.mx + g.ux * gap - g.px * shear
  const b1y = g.my + g.uy * gap - g.py * shear
  const shards = [
    [g.mx + g.px * sl * 1.3, g.my + g.py * sl * 1.3],
    [g.mx - g.px * sl * 1.0 + g.ux * sl * 0.5, g.my - g.py * sl * 1.0 + g.uy * sl * 0.5],
    [g.mx - g.ux * sl * 0.7 - g.px * sl * 0.6, g.my - g.uy * sl * 0.7 - g.py * sl * 0.6],
  ]
  return { a2x, a2y, b1x, b1y, shards }
})

const readout = computed(() => {
  const g = geom.value
  const fs = Math.max(props.unit * 0.19, 10)
  const showCheck = props.state === 'open'
  const text = showCheck ? '' : props.readoutText
  const textW = Math.max(text.length, 2) * fs * 0.55
  const padX = fs * 0.65
  const w = (showCheck ? fs * 1.5 : textW) + padX * 2
  const h = fs * 1.6
  const off = dotR.value + w / 2 + fs * 0.5
  return {
    fs,
    w,
    h,
    cx: props.x2 + g.ux * off,
    cy: props.y2 + g.uy * off,
    text,
    showCheck,
  }
})
</script>

<template>
  <g class="barrier-gate" :class="[`barrier-gate--${state}`, { 'barrier-gate--selected': selected }]">
    <line
      class="barrier-gate__hit"
      :x1="x1"
      :y1="y1"
      :x2="x2"
      :y2="y2"
      stroke="transparent"
      :stroke-width="Math.max(thickness * 3, 20)"
      stroke-linecap="round"
    />

    <template v-if="state === 'open'">
      <line
        class="barrier-gate__wall"
        :x1="x1"
        :y1="y1"
        :x2="shatter.a2x"
        :y2="shatter.a2y"
        :stroke="strokeColor"
        :stroke-width="thickness"
        stroke-linecap="round"
      />
      <line
        class="barrier-gate__wall"
        :x1="shatter.b1x"
        :y1="shatter.b1y"
        :x2="x2"
        :y2="y2"
        :stroke="strokeColor"
        :stroke-width="thickness"
        stroke-linecap="round"
      />
      <line
        v-for="(s, i) in shatter.shards"
        :key="i"
        class="barrier-gate__shard"
        :x1="geom.mx"
        :y1="geom.my"
        :x2="s[0]"
        :y2="s[1]"
        :stroke="strokeColor"
        :stroke-width="Math.max(thickness * 0.5, 2)"
        stroke-linecap="round"
      />
    </template>
    <line
      v-else
      class="barrier-gate__wall"
      :x1="x1"
      :y1="y1"
      :x2="x2"
      :y2="y2"
      :stroke="strokeColor"
      :stroke-width="thickness"
      stroke-linecap="round"
      :stroke-dasharray="state === 'locked' ? `${thickness * 0.2} ${thickness * 1.8}` : undefined"
      :opacity="opacity"
    />

    <circle :cx="x1" :cy="y1" :r="dotR" :fill="strokeColor" :opacity="opacity" />
    <circle :cx="x2" :cy="y2" :r="dotR" :fill="strokeColor" :opacity="opacity" />

    <g class="barrier-gate__readout" :opacity="opacity">
      <rect
        class="barrier-gate__badge"
        :x="readout.cx - readout.w / 2"
        :y="readout.cy - readout.h / 2"
        :width="readout.w"
        :height="readout.h"
        rx="3"
        :stroke="strokeColor"
        stroke-width="1"
      />
      <path
        v-if="readout.showCheck"
        :transform="`translate(${readout.cx}, ${readout.cy}) scale(${readout.fs * 0.05})`"
        d="M-8 0L-2 6L8 -6"
        fill="none"
        stroke="var(--success)"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <text
        v-else
        class="barrier-gate__value"
        :x="readout.cx"
        :y="readout.cy"
        :font-size="readout.fs"
        text-anchor="middle"
        dominant-baseline="central"
        :fill="strokeColor"
      >
        {{ readout.text }}
      </text>
    </g>
  </g>
</template>

<style scoped>
.barrier-gate {
  cursor: pointer;
}

.barrier-gate__hit {
  pointer-events: stroke;
}

.barrier-gate__wall {
  transition:
    stroke 140ms ease,
    opacity 140ms ease;
}

.barrier-gate--selected .barrier-gate__wall {
  filter: brightness(1.25);
}

.barrier-gate__shard {
  opacity: 0.85;
}

.barrier-gate__badge {
  fill: var(--bg-surface);
}

.barrier-gate--selected .barrier-gate__badge {
  fill: var(--bg-elevated);
}

.barrier-gate__value {
  font-family: var(--font-mono);
  font-weight: 600;
  letter-spacing: 0.02em;
  pointer-events: none;
}
</style>
