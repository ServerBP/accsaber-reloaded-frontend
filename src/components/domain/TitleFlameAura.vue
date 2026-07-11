<script setup lang="ts">
import { useElementCanvas } from '@/composables/useBackdropCanvas'
import type { TitleFlameAuraSpec } from '@/types/api/items'
import { lerpHex } from '@/utils/color'
import { withAlpha } from '@/utils/overlayCanvas'
import { randBetween as rand } from '@/utils/random'
import { titleAuraRect, type TitleAuraRect } from '@/utils/titleAura'
import { computed, useTemplateRef } from 'vue'

const props = defineProps<{
  aura: TitleFlameAuraSpec
  light: boolean
}>()

const palette = computed(() => {
  const a = props.aura
  const inner = (props.light ? a.lightInner : undefined) ?? a.inner ?? '#fff3b0'
  const outer = (props.light ? a.lightOuter : undefined) ?? a.outer ?? '#f5a300'
  const spark = (props.light ? a.lightSpark : undefined) ?? a.spark ?? '#fefce8'
  return { inner, outer, spark, mid: lerpHex(outer, inner, 0.45) }
})

interface Spark {
  x: number
  y: number
  vy: number
  drift: number
  born: number
  life: number
  size: number
}

interface Arc {
  x: number
  y: number
  segs: [number, number][]
  born: number
  life: number
}

let rect: TitleAuraRect | null = null
let sparks: Spark[] = []
let arcs: Arc[] = []

function resetSpark(s: Spark, now: number, warm: boolean) {
  if (!rect) return
  s.x = rect.x + rand(0, rect.w)
  s.y = rect.y + rect.h * rand(0.2, 1)
  s.vy = rect.fs * rand(1.3, 2.4)
  s.drift = rand(-0.4, 0.4) * rect.fs
  s.born = warm ? now - rand(0, 1200) : now
  s.life = rand(700, 1300)
  s.size = rect.fs * rand(0.06, 0.11)
}

function resetArc(a: Arc, now: number, warm: boolean) {
  if (!rect) return
  const fs = rect.fs
  a.x = rect.x + rect.w * rand(0.15, 0.85)
  a.y = rect.y + rect.h - fs * rand(0.6, 1.6)
  a.segs = []
  let px = a.x
  let py = a.y
  const n = 3 + Math.floor(rand(0, 3))
  let dir = rand(0, Math.PI * 2)
  for (let i = 0; i < n; i++) {
    dir += rand(-1.2, 1.2)
    const len = fs * rand(0.45, 0.85)
    px += Math.cos(dir) * len
    py += Math.sin(dir) * len - fs * 0.18
    a.segs.push([px, py])
  }
  a.born = now + (warm ? rand(0, 900) : rand(150, 900))
  a.life = rand(110, 190)
}

const LAYERS = [
  { part: 'outer', alpha: 0.30, lightAlpha: 0.30, extraH: 1.5, k1: 3.4, k2: 6.6, s1: 2.7, s2: 4.1, ph: 0, envP: 0.55 },
  { part: 'mid', alpha: 0.42, lightAlpha: 0.40, extraH: 0.85, k1: 4.2, k2: 7.7, s1: 3.3, s2: 4.9, ph: 2.1, envP: 0.8 },
  { part: 'inner', alpha: 0.62, lightAlpha: 0.55, extraH: 0.3, k1: 5.1, k2: 9.2, s1: 3.8, s2: 5.6, ph: 4.4, envP: 1.25 },
] as const

const canvasRef = useTemplateRef<HTMLCanvasElement>('canvas')

useElementCanvas(canvasRef, {
  init(_w, _h, now) {
    if (!canvasRef.value) return
    rect = titleAuraRect(canvasRef.value)
    sparks = Array.from({ length: 9 }, () => {
      const s = {} as Spark
      resetSpark(s, now, true)
      return s
    })
    arcs = Array.from({ length: 2 }, () => {
      const a = {} as Arc
      resetArc(a, now, true)
      return a
    })
  },
  draw(ctx, w, h, now, reduced) {
    if (!rect) return
    ctx.clearRect(0, 0, w, h)
    const { inner, outer, spark, mid } = palette.value
    const fs = rect.fs
    const t = reduced ? 1.7 : now / 1000
    const x0 = rect.x - fs * 0.55
    const x1 = rect.x + rect.w + fs * 0.55
    const span = x1 - x0
    const baseY = rect.y + rect.h + fs * 0.12
    const surge = 1 + 0.16 * Math.sin(t * 1.15)

    ctx.globalCompositeOperation = props.light ? 'source-over' : 'lighter'

    const glow = ctx.createRadialGradient(
      rect.x + rect.w / 2, baseY - rect.h * 0.4, 0,
      rect.x + rect.w / 2, baseY - rect.h * 0.4, span * 0.55,
    )
    glow.addColorStop(0, withAlpha(outer, props.light ? 0.14 : 0.22))
    glow.addColorStop(1, withAlpha(outer, 0))
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, w, h)

    const colors = { outer, mid, inner }
    const N = 44
    for (const L of LAYERS) {
      const color = colors[L.part]
      const alpha = props.light ? L.lightAlpha : L.alpha
      const maxH = rect.h + fs * L.extraH
      const grad = ctx.createLinearGradient(0, baseY, 0, baseY - maxH)
      grad.addColorStop(0, withAlpha(color, alpha * 0.75))
      grad.addColorStop(0.5, withAlpha(color, alpha * 0.6))
      grad.addColorStop(0.85, withAlpha(color, alpha * 0.2))
      grad.addColorStop(1, withAlpha(color, 0))
      const pts: [number, number][] = []
      for (let i = 0; i <= N; i++) {
        const u = i / N
        const x = x0 + span * u
        const env = Math.max(0.04, Math.pow(Math.sin(Math.PI * u), L.envP))
        const w1 = 0.5 + 0.5 * Math.sin(u * L.k1 * Math.PI * 2 + t * L.s1 + L.ph)
        const w2 = 0.5 + 0.5 * Math.sin(u * L.k2 * Math.PI * 2 - t * L.s2 + L.ph * 1.7)
        const peaks = Math.pow(w1 * (0.35 + 0.65 * w2), 1.35)
        pts.push([x, baseY - maxH * env * (0.18 + 0.95 * peaks) * surge])
      }
      ctx.beginPath()
      ctx.moveTo(x0, baseY)
      ctx.lineTo(pts[0][0], pts[0][1])
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2
        const my = (pts[i][1] + pts[i + 1][1]) / 2
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my)
      }
      ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1])
      ctx.lineTo(x1, baseY)
      ctx.closePath()
      ctx.fillStyle = grad
      ctx.fill()
    }

    for (const s of sparks) {
      let p = (now - s.born) / s.life
      if (reduced) p = ((s.born * 7) % 100) / 100
      if (p >= 1) {
        resetSpark(s, now, false)
        continue
      }
      const sx = s.x + Math.sin(p * 6 + s.born) * s.drift
      const sy = s.y - p * s.vy
      ctx.fillStyle = withAlpha(inner, (1 - p) * 0.85)
      ctx.beginPath()
      ctx.arc(sx, sy, s.size * (1 - p * 0.5), 0, Math.PI * 2)
      ctx.fill()
    }

    if (!reduced) {
      for (const a of arcs) {
        const p = (now - a.born) / a.life
        if (p >= 1) {
          resetArc(a, now, false)
          continue
        }
        if (p < 0) continue
        const alpha = (1 - p) * 0.9
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.strokeStyle = withAlpha(spark, alpha * 0.35)
        ctx.lineWidth = fs * 0.14
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        for (const [sx, sy] of a.segs) ctx.lineTo(sx, sy)
        ctx.stroke()
        ctx.strokeStyle = withAlpha(spark, alpha)
        ctx.lineWidth = fs * 0.055
        ctx.stroke()
      }
    }
    ctx.globalCompositeOperation = 'source-over'
  },
})
</script>

<template>
  <canvas ref="canvas" aria-hidden="true" />
</template>
