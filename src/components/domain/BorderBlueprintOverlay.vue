<script setup lang="ts">
import { useElementCanvas } from '@/composables/useBackdropCanvas'
import type { BorderBlueprintOverlaySpec, BorderColorValue } from '@/types/api/items'
import { overlaySpace } from '@/utils/overlayCanvas'
import { useTemplateRef } from 'vue'

const props = defineProps<{
  overlay: BorderBlueprintOverlaySpec
  avatarUrl?: string | null
  color?: BorderColorValue | null
}>()

const MARGIN = 20
const BASE_TIP_DEG = 60.98
const DEG = Math.PI / 180

const COMPASS = {
  needle: [[16.8, -16.7], [18.7, -14.5], [3.2, -0.9], [1.3, -3.1]],
  needleTip: [[1.3, -3.1], [3.2, -0.9], [0, 0]],
  pencil: [[15, -16.9], [18.2, -15.9], [9.9, 8.9], [7.5, 6.8]],
  band: [[13.1, -11.1], [16.3, -10.1], [15.7, -8.2], [12.5, -9.2]],
  ferrule: [[9.9, 8.9], [7.5, 6.8], [7, 9.6], [8.7, 11.6]],
  graphite: [[8.7, 11.6], [7, 9.6], [7.6, 13.7]],
  handle: [[17.8, -15.2], [20.4, -19], [18.8, -20.1], [16.2, -16.3]],
  knob: { c: [20, -20.2] as [number, number], r: 1.1 },
  disc: { c: [15.8, -13.9] as [number, number], r: 3.5 },
  screw: { c: [15.9, -13.95] as [number, number], r: 1.4 },
}

const STEEL = {
  needle: '#8e99ab',
  tip: '#5b6472',
  pencil: '#aab4c4',
  ferrule: '#d69a24',
  graphite: '#2f3540',
  handle: '#8e99ab',
  knob: '#5b6472',
  disc: '#b6c0cf',
  ring: '#2f3540',
  screw: '#2f3540',
}

interface BlueprintPhase {
  theta: number
  arcTo: number
  arcAlpha: number
  dimP: number
  dimAlpha: number
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

function phaseAt(now: number, from: number, to: number, periodMs: number, reduced: boolean): BlueprintPhase {
  if (reduced) {
    const mid = (from + to) / 2
    return { theta: mid, arcTo: mid, arcAlpha: 1, dimP: 1, dimAlpha: 1 }
  }
  const t = (now % periodMs) / periodMs
  let theta = from
  let arcTo = from
  let arcAlpha = 0
  if (t < 0.46) {
    theta = from + (to - from) * easeInOut(t / 0.46)
    arcTo = theta
    arcAlpha = 1
  } else if (t < 0.62) {
    theta = to
    arcTo = to
    arcAlpha = 1
  } else if (t < 0.74) {
    theta = to + (from - to) * easeInOut((t - 0.62) / 0.12)
    arcTo = to
    arcAlpha = 1 - (t - 0.62) / 0.12
  }
  let dimP = 0
  let dimAlpha = 1
  if (t >= 0.1 && t < 0.3) dimP = easeInOut((t - 0.1) / 0.2)
  else if (t >= 0.3 && t < 0.8) dimP = 1
  else if (t >= 0.8 && t < 0.92) {
    dimP = 1
    dimAlpha = 1 - (t - 0.8) / 0.12
  }
  return { theta, arcTo, arcAlpha, dimP, dimAlpha }
}

const canvasRef = useTemplateRef<HTMLCanvasElement>('canvas')

useElementCanvas(canvasRef, {
  init() {},
  draw(ctx, w, h, now, reduced) {
    ctx.clearRect(0, 0, w, h)
    const { sx, sy, toX, toY } = overlaySpace(w, h, MARGIN)
    const ov = props.overlay
    const draft = ov.draft ?? '#4ab8f7'
    const draftDim = ov.draftDim ?? '#2f8fd0'
    const pivot = ov.pivot ?? { x: 96, y: 96 }
    const mirror = ov.mirror === true
    const radius = ov.radius ?? 15.6
    const from = ov.sweepFromDeg ?? 43
    const to = ov.sweepToDeg ?? 75
    const p = phaseAt(now, from, to, ov.periodMs ?? 8000, reduced)

    if (p.arcAlpha > 0 && p.arcTo > from + 0.5) {
      ctx.strokeStyle = draft
      ctx.lineWidth = Math.max(1, 0.9 * sx)
      ctx.lineCap = 'round'
      ctx.globalAlpha = 0.7 * p.arcAlpha
      ctx.beginPath()
      ctx.ellipse(toX(pivot.x), toY(pivot.y), radius * sx, radius * sy, 0, from * DEG, p.arcTo * DEG)
      ctx.stroke()
    }

    const dim = ov.dim ?? { x1: 109.2, y1: 13.5, x2: 109.2, y2: 46.5 }
    if (p.dimP > 0) {
      const dx = dim.x2 - dim.x1
      const dy = dim.y2 - dim.y1
      const len = Math.hypot(dx, dy)
      const ux = dx / len
      const uy = dy / len
      const lx = dim.x1 + dx * p.dimP
      const ly = dim.y1 + dy * p.dimP
      ctx.globalAlpha = 0.65 * p.dimAlpha
      ctx.strokeStyle = draftDim
      ctx.lineWidth = Math.max(1, 0.7 * sx)
      ctx.lineCap = 'butt'
      ctx.beginPath()
      ctx.moveTo(toX(dim.x1), toY(dim.y1))
      ctx.lineTo(toX(lx), toY(ly))
      ctx.stroke()
      ctx.fillStyle = draftDim
      drawArrow(ctx, toX, toY, dim.x1, dim.y1, -ux, -uy)
      drawArrow(ctx, toX, toY, lx, ly, ux, uy)
    }

    const rad = (p.theta - (mirror ? 180 - BASE_TIP_DEG : BASE_TIP_DEG)) * DEG
    const cosD = Math.cos(rad)
    const sinD = Math.sin(rad)
    const tp = (pt: number[]): [number, number] => {
      const lx0 = mirror ? -pt[0] : pt[0]
      return [toX(pivot.x + lx0 * cosD - pt[1] * sinD), toY(pivot.y + lx0 * sinD + pt[1] * cosD)]
    }
    const poly = (pts: number[][], fill: string, alpha = 1) => {
      ctx.globalAlpha = alpha
      ctx.fillStyle = fill
      ctx.beginPath()
      const q = pts.map(tp)
      ctx.moveTo(q[0][0], q[0][1])
      for (let i = 1; i < q.length; i++) ctx.lineTo(q[i][0], q[i][1])
      ctx.closePath()
      ctx.fill()
    }
    const circle = (c: [number, number], rr: number, fill: string, stroke?: string) => {
      ctx.globalAlpha = 1
      const q = tp(c)
      ctx.beginPath()
      ctx.ellipse(q[0], q[1], rr * sx, rr * sy, 0, 0, Math.PI * 2)
      ctx.fillStyle = fill
      ctx.fill()
      if (stroke) {
        ctx.strokeStyle = stroke
        ctx.lineWidth = Math.max(0.6, 0.45 * sx)
        ctx.globalAlpha = 0.5
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
    poly(COMPASS.needle, STEEL.needle)
    poly(COMPASS.needleTip, STEEL.tip)
    poly(COMPASS.pencil, STEEL.pencil)
    poly(COMPASS.band, '#ffffff', 0.22)
    poly(COMPASS.ferrule, STEEL.ferrule)
    poly(COMPASS.graphite, STEEL.graphite)
    poly(COMPASS.handle, STEEL.handle)
    circle(COMPASS.knob.c, COMPASS.knob.r, STEEL.knob)
    circle(COMPASS.disc.c, COMPASS.disc.r, STEEL.disc, STEEL.ring)
    circle(COMPASS.screw.c, COMPASS.screw.r, STEEL.screw)
    ctx.globalAlpha = 1

    function drawArrow(
      c2d: CanvasRenderingContext2D,
      mx: (u: number) => number,
      my: (u: number) => number,
      ex: number,
      ey: number,
      aux: number,
      auy: number,
    ) {
      const ax = ex + aux * 3.5
      const ay = ey + auy * 3.5
      const px = -auy
      const py = aux
      c2d.beginPath()
      c2d.moveTo(mx(ax), my(ay))
      c2d.lineTo(mx(ex + px * 1.4), my(ey + py * 1.4))
      c2d.lineTo(mx(ex - px * 1.4), my(ey - py * 1.4))
      c2d.closePath()
      c2d.fill()
    }
  },
})
</script>

<template>
  <canvas ref="canvas" class="border-blueprint-overlay" aria-hidden="true" />
</template>

<style scoped>
.border-blueprint-overlay {
  position: absolute;
  inset: -20%;
  width: 140%;
  height: 140%;
  max-width: none;
  max-height: none;
  pointer-events: none;
}
</style>
