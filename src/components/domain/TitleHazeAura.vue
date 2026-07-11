<script setup lang="ts">
import { useElementCanvas } from '@/composables/useBackdropCanvas'
import type { TitleHazeAuraSpec } from '@/types/api/items'
import { withAlpha } from '@/utils/overlayCanvas'
import { randBetween as rand } from '@/utils/random'
import { titleAuraRect, type TitleAuraRect } from '@/utils/titleAura'
import { computed, useTemplateRef } from 'vue'

const props = defineProps<{
  aura: TitleHazeAuraSpec
  light: boolean
}>()

const palette = computed(() => {
  const a = props.aura
  return {
    color: (props.light ? a.lightColor : undefined) ?? a.color ?? '#3b82f6',
    glow: (props.light ? a.lightGlow : undefined) ?? a.glow ?? '#93c5fd',
  }
})

interface Orb {
  sx: number
  sy: number
  theta: number
  born: number
  dur: number
  size: number
  bend: number
}

interface Mote {
  theta: number
  speed: number
  pad: number
  tw: number
}

interface Ripple {
  theta: number
  born: number
}

let rect: TitleAuraRect | null = null
let cw = 0
let ch = 0
let orbs: Orb[] = []
let motes: Mote[] = []
let ripples: Ripple[] = []
let swell = 0
let swellAt = 0

function resetOrb(o: Orb, now: number, warm: boolean) {
  if (!rect) return
  const fs = rect.fs
  const edge = Math.floor(rand(0, 4))
  if (edge === 0) {
    o.sx = rand(0, cw)
    o.sy = -fs * 0.3
  } else if (edge === 1) {
    o.sx = cw + fs * 0.3
    o.sy = rand(0, ch)
  } else if (edge === 2) {
    o.sx = rand(0, cw)
    o.sy = ch + fs * 0.3
  } else {
    o.sx = -fs * 0.3
    o.sy = rand(0, ch)
  }
  o.theta = rand(0, Math.PI * 2)
  o.born = now + (warm ? rand(-2600, 1800) : rand(400, 2600))
  o.dur = rand(2000, 3200)
  o.size = fs * rand(0.11, 0.17)
  o.bend = rand(-1, 1) * fs * 1.6
}

function ellipsePoint(theta: number, padX: number, padY: number, t: number, wobAmp = 1): [number, number] {
  const r = rect as TitleAuraRect
  const cx = r.x + r.w / 2
  const cy = r.y + r.h / 2
  const wob = 1 + wobAmp * (0.045 * Math.sin(3 * theta + t * 0.9) + 0.03 * Math.sin(5 * theta - t * 1.4))
  const rx = (r.w / 2 + padX) * wob
  const ry = (r.h / 2 + padY) * wob
  return [cx + Math.cos(theta) * rx, cy + Math.sin(theta) * ry]
}

const BANDS = [
  { padX: 0.72, padY: 0.5, alpha: 0.09, wob: 1.4, ph: 0 },
  { padX: 0.42, padY: 0.3, alpha: 0.13, wob: 1.0, ph: 2.4 },
  { padX: 0.16, padY: 0.12, alpha: 0.17, wob: 0.7, ph: 4.1 },
] as const

const RIPPLE_MS = 650

const canvasRef = useTemplateRef<HTMLCanvasElement>('canvas')

useElementCanvas(canvasRef, {
  init(w, h, now) {
    if (!canvasRef.value) return
    rect = titleAuraRect(canvasRef.value)
    cw = w
    ch = h
    orbs = Array.from({ length: 3 }, () => {
      const o = {} as Orb
      resetOrb(o, now, true)
      return o
    })
    motes = Array.from({ length: 6 }, () => ({
      theta: rand(0, Math.PI * 2),
      speed: rand(0.12, 0.3) * (Math.random() < 0.5 ? -1 : 1),
      pad: rand(0.1, 0.5),
      tw: rand(0, Math.PI * 2),
    }))
    ripples = []
    swell = 0
  },
  draw(ctx, w, h, now, reduced) {
    if (!rect) return
    ctx.clearRect(0, 0, w, h)
    const { color, glow } = palette.value
    const fs = rect.fs
    const t = reduced ? 1.2 : now / 1000
    const cx = rect.x + rect.w / 2
    const cy = rect.y + rect.h / 2
    const sw = swell * Math.exp(-(now - swellAt) / 500)

    ctx.globalCompositeOperation = props.light ? 'source-over' : 'lighter'

    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, rect.w * 0.62)
    core.addColorStop(0, withAlpha(glow, (props.light ? 0.1 : 0.14) + sw * 0.07))
    core.addColorStop(0.55, withAlpha(glow, (props.light ? 0.05 : 0.07) + sw * 0.04))
    core.addColorStop(1, withAlpha(glow, 0))
    ctx.fillStyle = core
    ctx.fillRect(0, 0, w, h)

    ctx.lineJoin = 'round'
    const K = 72
    for (const b of BANDS) {
      ctx.beginPath()
      for (let i = 0; i <= K; i++) {
        const theta = (i / K) * Math.PI * 2
        const [px, py] = ellipsePoint(
          theta,
          b.padX * fs + sw * fs * 0.22,
          b.padY * fs + sw * fs * 0.16,
          t + b.ph,
          b.wob,
        )
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      const a = (b.alpha + sw * 0.08) * (props.light ? 0.9 : 1)
      ctx.strokeStyle = withAlpha(color, a * 0.3)
      ctx.lineWidth = fs * 0.85
      ctx.stroke()
      ctx.strokeStyle = withAlpha(color, a * 0.45)
      ctx.lineWidth = fs * 0.45
      ctx.stroke()
    }

    for (const m of motes) {
      const theta = m.theta + t * m.speed
      const [px, py] = ellipsePoint(theta, fs * (0.3 + m.pad * 0.7), fs * (0.25 + m.pad * 0.5), t)
      const a = 0.35 + 0.35 * Math.sin(t * 2.2 + m.tw)
      ctx.fillStyle = withAlpha(glow, a)
      ctx.beginPath()
      ctx.arc(px, py, fs * 0.05, 0, Math.PI * 2)
      ctx.fill()
    }

    for (const o of orbs) {
      let p = (now - o.born) / o.dur
      if (reduced) p = 0.55
      if (p >= 1) {
        swell = Math.min(1, sw + 1)
        swellAt = now
        ripples.push({ theta: o.theta, born: now })
        resetOrb(o, now, false)
        continue
      }
      if (p < 0) continue
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
      const [tx, ty] = ellipsePoint(o.theta, fs * 0.3, fs * 0.25, t)
      const mx = (o.sx + tx) / 2 + o.bend
      const my = (o.sy + ty) / 2 + o.bend * 0.4
      const q = (a: number, b: number, c: number, s: number) =>
        (1 - s) * (1 - s) * a + 2 * (1 - s) * s * b + s * s * c
      for (let k = 2; k >= 0; k--) {
        const s = Math.max(0, e - k * 0.05)
        const px = q(o.sx, mx, tx, s)
        const py = q(o.sy, my, ty, s)
        const fade = 1 - k * 0.32
        ctx.fillStyle = withAlpha(glow, (0.25 + 0.6 * e) * fade)
        ctx.beginPath()
        ctx.arc(px, py, o.size * (1 - k * 0.22) * (0.6 + 0.4 * e), 0, Math.PI * 2)
        ctx.fill()
      }
    }

    ripples = ripples.filter((r) => now - r.born < RIPPLE_MS)
    for (const r of ripples) {
      const p = (now - r.born) / RIPPLE_MS
      const [px, py] = ellipsePoint(r.theta, fs * 0.3, fs * 0.25, t)
      ctx.strokeStyle = withAlpha(glow, (1 - p) * 0.35)
      ctx.lineWidth = fs * 0.04
      ctx.beginPath()
      ctx.arc(px, py, fs * (0.15 + p * 1.1), 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalCompositeOperation = 'source-over'
  },
})
</script>

<template>
  <canvas ref="canvas" aria-hidden="true" />
</template>
