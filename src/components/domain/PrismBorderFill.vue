<script setup lang="ts">
import { useElementCanvas } from '@/composables/useBackdropCanvas'
import type { PrismFill } from '@/types/api/items'
import { overlaySpace } from '@/utils/overlayCanvas'
import { randBetween as rand } from '@/utils/random'
import { useTemplateRef } from 'vue'

const props = defineProps<{
  fill: PrismFill
}>()

const MARGIN = 25
const LO = -MARGIN
const HI = 100 + MARGIN
const GRID = 9

interface Facet {
  pts: [number, number][]
  th: number
  bias: number
  gx: number
  gy: number
}

interface Slice {
  y: number
  h: number
  dx: number
}

let facets: Facet[] = []
let slices: Slice[] = []
let light = 0.6
let target = 0.6
let step = 0
let stepAt = 0
let nextSnap = 0
let glitchUntil = 0
let flare: { facet: Facet; start: number } | null = null

function parseRgb(hex: string): [number, number, number] {
  const m = hex.match(/^#([0-9a-fA-F]{6})/)
  if (!m) return [249, 168, 212]
  return [
    parseInt(m[1].slice(0, 2), 16),
    parseInt(m[1].slice(2, 4), 16),
    parseInt(m[1].slice(4, 6), 16),
  ]
}

function buildFacets() {
  const span = HI - LO
  const cell = span / GRID
  const pts: [number, number][][] = []
  for (let r = 0; r <= GRID; r++) {
    const row: [number, number][] = []
    for (let c = 0; c <= GRID; c++) {
      let x = LO + c * cell
      let y = LO + r * cell
      if (c > 0 && c < GRID) x += (Math.random() - 0.5) * cell * 0.7
      if (r > 0 && r < GRID) y += (Math.random() - 0.5) * cell * 0.7
      row.push([x, y])
    }
    pts.push(row)
  }
  facets = []
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const a = pts[r][c]
      const b = pts[r][c + 1]
      const d = pts[r + 1][c + 1]
      const e = pts[r + 1][c]
      const tris = Math.random() < 0.5 ? [[a, b, d], [a, d, e]] : [[a, b, e], [b, d, e]]
      for (const tri of tris) {
        const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3
        const cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3
        facets.push({
          pts: tri as [number, number][],
          th: Math.atan2(cy - 50, cx - 50),
          bias: Math.random() * 0.34,
          gx: 0,
          gy: 0,
        })
      }
    }
  }
}

function assignGlitch() {
  const shearPct = props.fill.shearPct ?? 0.45
  for (const facet of facets) {
    if (Math.random() < shearPct) {
      facet.gx = (Math.random() - 0.5) * 5
      facet.gy = (Math.random() - 0.5) * 3
    } else {
      facet.gx = 0
      facet.gy = 0
    }
  }
  const count = props.fill.slices ?? 4
  slices = []
  for (let i = 0; i < count; i++) {
    slices.push({
      y: rand(LO + 8, HI - 16),
      h: rand(2.5, 6),
      dx: (Math.random() < 0.5 ? -1 : 1) * rand(1.5, 3.5),
    })
  }
}

const canvasRef = useTemplateRef<HTMLCanvasElement>('canvas')

useElementCanvas(canvasRef, {
  init(_w, _h, now) {
    buildFacets()
    assignGlitch()
    light = rand(0, Math.PI * 2)
    target = light
    step = 0
    nextSnap = now + (props.fill.snapMinS ?? 3) * 1000 * rand(0.3, 1)
    glitchUntil = 0
    flare = null
  },
  draw(ctx, w, h, now, reduced) {
    const lo = parseRgb(props.fill.lo ?? props.fill.rose)
    const hi = props.fill.hi ? parseRgb(props.fill.hi) : [255, 255, 255]
    const edge = props.fill.edge
    const fringeA = props.fill.fringeA ?? 'rgba(255,50,170,0.6)'
    const fringeB = props.fill.fringeB ?? 'rgba(50,190,255,0.6)'
    const glitchMs = props.fill.glitchMs ?? 400
    const steps = props.fill.steps ?? 3

    if (!reduced) {
      if (now >= nextSnap && step === 0) {
        target = light + (1 + Math.random() * 1.8) * (Math.random() < 0.5 ? -1 : 1)
        step = steps
        stepAt = now
      }
      if (step > 0 && now >= stepAt) {
        light += (target - light) / step
        step--
        stepAt = now + 90
        glitchUntil = now + glitchMs
        assignGlitch()
        if (step === 0) {
          const min = (props.fill.snapMinS ?? 3) * 1000
          const max = (props.fill.snapMaxS ?? 5) * 1000
          nextSnap = now + rand(min, max)
        }
      }
    }

    const fringe = reduced || now < glitchUntil
    const { sx, sy, toX, toY } = overlaySpace(w, h, MARGIN)

    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = props.fill.ink ?? '#2a1020'
    ctx.fillRect(0, 0, w, h)

    for (const facet of facets) {
      const b = 0.3 + facet.bias + 0.55 * Math.pow(Math.max(0, Math.cos(facet.th - light)), 2)
      const v = Math.min(1, b)
      const r = Math.round(lo[0] + (hi[0] - lo[0]) * v)
      const g = Math.round(lo[1] + (hi[1] - lo[1]) * v)
      const bl = Math.round(lo[2] + (hi[2] - lo[2]) * v)
      const ox = fringe ? facet.gx : 0
      const oy = fringe ? facet.gy : 0

      ctx.beginPath()
      ctx.moveTo(toX(facet.pts[0][0] + ox), toY(facet.pts[0][1] + oy))
      ctx.lineTo(toX(facet.pts[1][0] + ox), toY(facet.pts[1][1] + oy))
      ctx.lineTo(toX(facet.pts[2][0] + ox), toY(facet.pts[2][1] + oy))
      ctx.closePath()
      ctx.fillStyle = `rgba(${r},${g},${bl},${0.68 + 0.32 * v})`
      ctx.fill()
      ctx.lineWidth = Math.max(1, sx * 0.5)
      ctx.strokeStyle = edge
      ctx.globalAlpha = 0.38
      ctx.stroke()
      ctx.globalAlpha = 1
      if (fringe) {
        ctx.save()
        ctx.lineWidth = Math.max(1, sx * 0.7)
        ctx.translate(sx * 1.4, 0)
        ctx.strokeStyle = fringeA
        ctx.stroke()
        ctx.translate(-sx * 2.8, 0)
        ctx.strokeStyle = fringeB
        ctx.stroke()
        ctx.restore()
      }
    }

    if (!reduced) {
      if (!flare && Math.random() < 0.004) {
        flare = { facet: facets[Math.floor(Math.random() * facets.length)], start: now }
      }
      if (flare) {
        const e = (now - flare.start) / 150
        if (e >= 1) {
          flare = null
        } else {
          const f = flare.facet
          ctx.beginPath()
          ctx.moveTo(toX(f.pts[0][0]), toY(f.pts[0][1]))
          ctx.lineTo(toX(f.pts[1][0]), toY(f.pts[1][1]))
          ctx.lineTo(toX(f.pts[2][0]), toY(f.pts[2][1]))
          ctx.closePath()
          ctx.fillStyle = `rgba(255,255,255,${1 - e})`
          ctx.fill()
        }
      }
    }

    if (fringe) {
      for (const slice of slices) {
        const ys = Math.max(0, Math.round(toY(slice.y)))
        const hs = Math.max(1, Math.round(slice.h * sy))
        const dx = Math.round(slice.dx * sx)
        if (ys + hs > h) continue
        ctx.drawImage(ctx.canvas, 0, ys, w, hs, dx, ys, w, hs)
        ctx.fillStyle = 'rgba(255,255,255,0.06)'
        ctx.fillRect(0, ys, w, hs)
        ctx.fillStyle = fringeB
        ctx.globalAlpha = 0.5
        ctx.fillRect(0, ys - 1, w, 1)
        ctx.fillStyle = fringeA
        ctx.fillRect(0, ys + hs, w, 1)
        ctx.globalAlpha = 1
      }
    }
  },
})
</script>

<template>
  <canvas ref="canvas" class="prism-border-fill" aria-hidden="true" />
</template>

<style scoped>
.prism-border-fill {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  pointer-events: none;
}
</style>
