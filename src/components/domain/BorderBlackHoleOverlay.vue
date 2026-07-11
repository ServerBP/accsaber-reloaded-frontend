<script setup lang="ts">
import { useElementCanvas } from '@/composables/useBackdropCanvas'
import type { BorderBlackHoleOverlaySpec, BorderColorValue } from '@/types/api/items'
import { darken, lerpHex } from '@/utils/color'
import { fillMeanLuminance, frameDelta, overlaySpace, withAlpha } from '@/utils/overlayCanvas'
import { randBetween as rand } from '@/utils/random'
import { computed, useTemplateRef } from 'vue'

const props = defineProps<{
  overlay: BorderBlackHoleOverlaySpec
  avatarUrl?: string | null
  color?: BorderColorValue | null
}>()

const MARGIN = 20
const HOLE_X = 50
const HOLE_Y = 100
const R = 8.8
const TILT = -0.35

interface Wisp {
  angle: number
  radius: number
  angVel: number
}

let wisps: Wisp[] = []
let lastNow = 0

const vortexActive = computed(() => {
  const v = props.overlay.vortex
  if (!v) return false
  const lum = fillMeanLuminance(props.color?.states?.[0]?.fill)
  return lum != null && lum <= v.maxLuminance
})

function resetWisp(w: Wisp) {
  w.angle = rand(0, Math.PI * 2)
  w.radius = rand(15, 24)
  w.angVel = rand(1.2, 2.2)
}

function bandPos(angle: number, radius: number): { x: number; y: number } {
  const ex = Math.cos(angle) * radius
  const ey = Math.sin(angle) * radius * 0.42
  return {
    x: HOLE_X + ex * Math.cos(TILT) - ey * Math.sin(TILT),
    y: HOLE_Y + ex * Math.sin(TILT) + ey * Math.cos(TILT),
  }
}

const canvasRef = useTemplateRef<HTMLCanvasElement>('canvas')

useElementCanvas(canvasRef, {
  init(_w, _h, now) {
    wisps = Array.from({ length: 12 }, () => {
      const w = { angle: 0, radius: 0, angVel: 0 }
      resetWisp(w)
      return w
    })
    lastNow = now
  },
  draw(ctx, w, h, now, reduced) {
    ctx.clearRect(0, 0, w, h)
    const { s, toX, toY } = overlaySpace(w, h, MARGIN)
    const glow = props.overlay.glow ?? '#ffb46b'
    const dt = frameDelta(now, lastNow, reduced)
    lastNow = now
    const t = now / 1000
    const cx0 = toX(HOLE_X)
    const cy0 = toY(HOLE_Y)
    const rp0 = R * s

    function strokeBandArc(from: number, to: number, width: number, alpha: number, radius: number) {
      ctx.strokeStyle = withAlpha(glow, alpha)
      ctx.lineWidth = width
      ctx.lineCap = 'round'
      ctx.beginPath()
      const steps = 22
      for (let i = 0; i <= steps; i++) {
        const p = bandPos(from + ((to - from) * i) / steps, radius)
        if (i === 0) ctx.moveTo(toX(p.x), toY(p.y))
        else ctx.lineTo(toX(p.x), toY(p.y))
      }
      ctx.stroke()
    }

    if (vortexActive.value) {
      const spec = props.overlay.vortex!
      const hot = spec.color ?? glow
      const ember = darken(hot, 0.9)
      const arms = spec.arms ?? 2
      const sublines = 3
      const turns = 1.15
      const rInner = R * 1.15
      const rOuter = R * 1.15 + 31
      const spin = reduced ? 0 : -t * 0.85

      const dust = ctx.createRadialGradient(cx0, cy0, rp0 * 1.1, cx0, cy0, rp0 * 4)
      dust.addColorStop(0, withAlpha(hot, 0.12))
      dust.addColorStop(1, withAlpha(hot, 0))
      ctx.fillStyle = dust
      ctx.beginPath()
      ctx.ellipse(cx0, cy0, rp0 * 4, rp0 * 4 * 0.5, TILT, 0, Math.PI * 2)
      ctx.fill()

      const STEPS = 40
      ctx.lineCap = 'round'
      for (let a = 0; a < arms; a++) {
        const armBase = (a / arms) * Math.PI * 2
        for (let sub = 0; sub < sublines; sub++) {
          const off = (sub - (sublines - 1) / 2) * 0.16
          const jitter = off * 2.2
          let prev: { x: number; y: number } | null = null
          for (let i = 0; i <= STEPS; i++) {
            const u = i / STEPS
            const theta = armBase + off + spin + u * turns * Math.PI * 2
            const radius = rInner + (rOuter - rInner) * Math.pow(u, 0.85) + jitter * Math.sin(u * 8)
            const p = bandPos(theta, radius)
            const px = toX(p.x)
            const py = toY(p.y)
            if (prev) {
              const alpha = Math.min(1, 0.2 + 0.8 * Math.pow(1 - u, 1.1))
              ctx.strokeStyle = withAlpha(lerpHex(hot, ember, u), alpha)
              ctx.lineWidth = Math.max(0.5, (2.4 - u * 2) * s)
              ctx.beginPath()
              ctx.moveTo(prev.x, prev.y)
              ctx.lineTo(px, py)
              ctx.stroke()
            }
            prev = { x: px, y: py }
          }
        }
      }
    }

    if (!reduced) {
      for (const wisp of wisps) {
        wisp.angle += wisp.angVel * (1 + (24 - wisp.radius) * 0.09) * dt
        wisp.radius -= (2 + (24 - wisp.radius) * 0.4) * dt
        if (wisp.radius < R * 1.05) resetWisp(wisp)
        const fade = Math.min(1, (24 - wisp.radius) / 12)
        strokeBandArc(wisp.angle - 0.5, wisp.angle, Math.max(0.8, 0.7 * s), 0.12 + 0.4 * fade, wisp.radius)
      }
    }

    const hotspot = t * 0.6

    strokeBandArc(Math.PI, Math.PI * 2, Math.max(1, 1 * s), 0.4, R * 1.55)
    if (Math.sin(hotspot) < 0) strokeBandArc(hotspot - 0.4, hotspot + 0.4, Math.max(1.2, 1.3 * s), 0.75, R * 1.55)

    const cx = toX(HOLE_X)
    const cy = toY(HOLE_Y)
    const rp = R * s
    const pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(t * 1.4)
    const halo = ctx.createRadialGradient(cx, cy, rp, cx, cy, rp * 1.45)
    halo.addColorStop(0, withAlpha(glow, 0.32 + pulse * 0.14))
    halo.addColorStop(1, withAlpha(glow, 0))
    ctx.fillStyle = halo
    ctx.beginPath()
    ctx.arc(cx, cy, rp * 1.45, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#000000'
    ctx.beginPath()
    ctx.arc(cx, cy, rp, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = withAlpha(glow, 0.85 + pulse * 0.15)
    ctx.lineWidth = Math.max(1, 0.9 * s)
    ctx.beginPath()
    ctx.arc(cx, cy, rp * 1.04, 0, Math.PI * 2)
    ctx.stroke()

    strokeBandArc(0, Math.PI, Math.max(1.2, 1.4 * s), 0.85, R * 1.55)
    strokeBandArc(Math.PI * 0.72, Math.PI * 0.98, Math.max(1.4, 1.6 * s), 0.5, R * 1.55)
    if (Math.sin(hotspot) >= 0) strokeBandArc(hotspot - 0.4, hotspot + 0.4, Math.max(1.4, 1.7 * s), 0.95, R * 1.55)
  },
})
</script>

<template>
  <canvas ref="canvas" class="border-blackhole-overlay" aria-hidden="true" />
</template>

<style scoped>
.border-blackhole-overlay {
  position: absolute;
  inset: -20%;
  width: 140%;
  height: 140%;
  max-width: none;
  max-height: none;
  pointer-events: none;
}
</style>
