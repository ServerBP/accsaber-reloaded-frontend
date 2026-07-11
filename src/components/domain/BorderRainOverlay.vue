<script setup lang="ts">
import { useElementCanvas } from '@/composables/useBackdropCanvas'
import type { BorderColorValue, BorderRainOverlaySpec } from '@/types/api/items'
import { frameDelta, overlaySpace } from '@/utils/overlayCanvas'
import { randBetween as rand } from '@/utils/random'
import { useTemplateRef, watch } from 'vue'

const props = defineProps<{
  overlay: BorderRainOverlaySpec
  avatarUrl?: string | null
  color?: BorderColorValue | null
}>()

const MARGIN = 20
const SPLASH_MS = 260
const RIPPLE_MS = 700
const SURFACE = 97
const CLOUD_BASE = 8
const SLANT = 0.12

interface Drop {
  x: number
  y: number
  speed: number
  len: number
  alpha: number
}

interface Splash {
  x: number
  bornAt: number
}

interface Ripple {
  x: number
  y: number
  bornAt: number
}

let drops: Drop[] = []
let splashes: Splash[] = []
let ripples: Ripple[] = []
let lastNow = 0
let reflection: HTMLCanvasElement | null = null

watch(
  () => props.avatarUrl,
  (url) => {
    reflection = null
    if (!url || props.overlay.puddle !== true) return
    const img = new Image()
    img.onload = () => {
      const off = document.createElement('canvas')
      off.width = 12
      off.height = 12
      const octx = off.getContext('2d')
      if (!octx) return
      octx.drawImage(img, 0, 0, 12, 12)
      reflection = off
    }
    img.src = url
  },
  { immediate: true },
)

function resetDrop(d: Drop, initial = false) {
  d.x = rand(-6, 92)
  d.y = initial ? rand(CLOUD_BASE, SURFACE - 4) : rand(-2, 6)
  d.speed = rand(120, 190)
  d.len = rand(6, 10)
  d.alpha = rand(0.55, 0.9)
}

function makeDrop(initial: boolean): Drop {
  const d = { x: 0, y: 0, speed: 0, len: 0, alpha: 0 }
  resetDrop(d, initial)
  return d
}

const canvasRef = useTemplateRef<HTMLCanvasElement>('canvas')

useElementCanvas(canvasRef, {
  init(_w, _h, now) {
    drops = Array.from({ length: props.overlay.drops ?? 14 }, () => makeDrop(true))
    splashes = []
    ripples = []
    lastNow = now
  },
  draw(ctx, w, h, now, reduced) {
    ctx.clearRect(0, 0, w, h)
    const { sx, sy, toX, toY } = overlaySpace(w, h, MARGIN)
    const color = props.overlay.color ?? '#a4c6e8'
    const dt = frameDelta(now, lastNow, reduced)
    lastNow = now

    if (props.overlay.puddle === true && reflection) {
      const rw = 88 * sx
      const ry = toY(94.6)
      const rh = 11 * sy
      const slices = 8
      const sliceH = rh / slices
      const t = now / 1000
      ctx.save()
      ctx.globalAlpha = 0.38
      for (let i = 0; i < slices; i++) {
        const wobble = reduced ? 0 : Math.sin(t * 2.2 + i * 1.1) * (0.4 + i * 0.18) * sx
        const srcY = reflection.height * (1 - (i + 1) / slices)
        const srcH = reflection.height / slices
        ctx.drawImage(
          reflection,
          0, srcY, reflection.width, srcH,
          toX(6) + wobble, ry + i * sliceH, rw, sliceH + 1,
        )
      }
      ctx.restore()
    }

    ctx.save()
    ctx.beginPath()
    ctx.rect(toX(-8), toY(CLOUD_BASE), 118 * sx, (SURFACE - CLOUD_BASE + 2) * sy)
    ctx.clip()
    ctx.strokeStyle = color
    ctx.lineCap = 'round'
    ctx.lineWidth = Math.max(1, 1.1 * sx)
    for (const d of drops) {
      if (!reduced) {
        d.y += d.speed * dt
        d.x += d.speed * dt * SLANT
        if (d.y > SURFACE) {
          const lx = Math.min(Math.max(d.x, 2), 98)
          if (props.overlay.splash !== false) splashes.push({ x: lx, bornAt: now })
          if (props.overlay.puddle === true) ripples.push({ x: lx, y: rand(99, 105), bornAt: now })
          resetDrop(d)
        }
      }
      ctx.globalAlpha = d.alpha
      ctx.beginPath()
      ctx.moveTo(toX(d.x - d.len * SLANT), toY(d.y - d.len))
      ctx.lineTo(toX(d.x), toY(d.y))
      ctx.stroke()
    }
    ctx.restore()

    ctx.fillStyle = color
    if (!reduced && props.overlay.splash !== false) {
      splashes = splashes.filter((sp) => now - sp.bornAt < SPLASH_MS)
      for (const sp of splashes) {
        const p = (now - sp.bornAt) / SPLASH_MS
        const spread = (1.6 + p * 3.4) * sx
        const rise = toY(SURFACE - 1.5 - p * 3.5)
        const r = Math.max(0.8, 0.85 * sx)
        ctx.globalAlpha = (1 - p) * 0.7
        ctx.beginPath()
        ctx.arc(toX(sp.x) - spread, rise, r, 0, Math.PI * 2)
        ctx.arc(toX(sp.x) + spread, rise, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = (1 - p) * 0.4
        ctx.beginPath()
        ctx.arc(toX(sp.x), toY(SURFACE - 2 - p * 5.5), r, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    if (!reduced && props.overlay.puddle === true) {
      ripples = ripples.filter((r) => now - r.bornAt < RIPPLE_MS)
      ctx.strokeStyle = color
      ctx.lineWidth = Math.max(1, sx)
      for (const r of ripples) {
        const p = (now - r.bornAt) / RIPPLE_MS
        const rx = (2 + p * 8) * sx
        const ry = rx * 0.32
        ctx.globalAlpha = (1 - p) * 0.5
        ctx.beginPath()
        ctx.ellipse(toX(r.x), toY(r.y), rx, ry, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
  },
})
</script>

<template>
  <canvas ref="canvas" class="border-rain-overlay" aria-hidden="true" />
</template>

<style scoped>
.border-rain-overlay {
  position: absolute;
  inset: -20%;
  width: 140%;
  height: 140%;
  max-width: none;
  max-height: none;
  pointer-events: none;
}
</style>
