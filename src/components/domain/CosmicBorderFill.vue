<script setup lang="ts">
import { useElementCanvas } from '@/composables/useBackdropCanvas'
import type { CosmicFill } from '@/types/api/items'
import { darken, lighten } from '@/utils/color'
import { frameDelta, overlaySpace, withAlpha } from '@/utils/overlayCanvas'
import { randBetween as rand } from '@/utils/random'
import { useTemplateRef } from 'vue'

const props = defineProps<{
  fill: CosmicFill
  sink?: { x: number; y: number; r: number } | null
}>()

const MARGIN = 25
const CENTER = 50
const BAND = { min: 1.5, max: 98.5 }
const SPIRAL_MS = 1100

interface Star {
  x: number
  y: number
  size: number
  bright: boolean
  phase: number
  speed: number
}

interface Nebula {
  x: number
  y: number
  r: number
  color: string
  phase: number
}

interface Planet {
  x: number
  y: number
  r: number
  color: string
  ringed: boolean
}

interface Hole {
  x: number
  y: number
  r: number
  tilt: number
}

interface Streak {
  x: number
  y: number
  dx: number
  dy: number
  bornAt: number
  lifeMs: number
  tail: number
}

type FieldKind = 'star' | 'nebula' | 'planet'

interface FieldElement {
  kind: FieldKind
  index: number
  gone: boolean
  respawnAt: number
  fadeInUntil: number
}

interface Pull {
  el: FieldElement
  pts: Array<{ x: number; y: number }>
  cum: number[]
  total: number
  dist: number
  side: 1 | -1
  spiralT: number
}

let stars: Star[] = []
let nebulas: Nebula[] = []
let planets: Planet[] = []
let holes: Hole[] = []
let comet: Streak | null = null
let shooting: Streak | null = null
let nextCometAt = 0
let nextShootingAt = 0
let field: FieldElement[] = []
let pulls: Pull[] = []
let nextPullAt = 0
let lastNow = 0

function bandPoint(theta: number, minR = 48, maxR = 98): { x: number; y: number } {
  const r = Math.sqrt(rand(minR * minR, maxR * maxR))
  return {
    x: CENTER + Math.cos(theta) * r,
    y: CENTER + Math.sin(theta) * r,
  }
}

function stratifiedAngles(count: number): number[] {
  const offset = rand(0, Math.PI * 2)
  const step = (Math.PI * 2) / count
  return Array.from({ length: count }, (_, k) => offset + k * step + rand(-step * 0.3, step * 0.3))
}

function rotated(x: number, y: number, angle: number): { x: number; y: number } {
  const dx = x - CENTER
  const dy = y - CENTER
  return {
    x: CENTER + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: CENTER + dx * Math.sin(angle) + dy * Math.cos(angle),
  }
}

function fieldPos(el: FieldElement): { x: number; y: number } {
  if (el.kind === 'star') return stars[el.index]
  if (el.kind === 'nebula') return nebulas[el.index]
  return planets[el.index]
}

function clampToBand(v: number): number {
  return Math.min(BAND.max, Math.max(BAND.min, v))
}

function buildPullRoute(from: { x: number; y: number }, sink: { x: number; y: number }): { pts: Array<{ x: number; y: number }>; side: 1 | -1 } {
  const side: 1 | -1 = from.x >= sink.x ? 1 : -1
  const edgeX = side > 0 ? BAND.max : BAND.min
  const distToTop = Math.abs(from.y - BAND.min)
  const distToEdge = Math.abs(from.x - edgeX)
  const pts: Array<{ x: number; y: number }> = [{ x: from.x, y: from.y }]
  if (distToTop < distToEdge) {
    pts.push({ x: clampToBand(from.x), y: BAND.min })
    pts.push({ x: edgeX, y: BAND.min })
  } else {
    pts.push({ x: edgeX, y: clampToBand(Math.min(from.y, BAND.max - 10)) })
  }
  pts.push({ x: edgeX, y: BAND.max })
  pts.push({ x: sink.x + side * 16, y: BAND.max })
  return { pts, side }
}

function startPull(el: FieldElement, sink: { x: number; y: number }, angle: number) {
  const raw = fieldPos(el)
  const world = rotated(raw.x, raw.y, angle)
  const { pts, side } = buildPullRoute(world, sink)
  const cum = [0]
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  }
  el.gone = true
  pulls.push({ el, pts, cum, total: cum[cum.length - 1], dist: 0, side, spiralT: 0 })
}

function routePoint(p: Pull): { x: number; y: number } {
  const d = Math.min(p.dist, p.total)
  for (let i = 1; i < p.pts.length; i++) {
    if (d <= p.cum[i]) {
      const seg = p.cum[i] - p.cum[i - 1]
      const t = seg > 0 ? (d - p.cum[i - 1]) / seg : 1
      return {
        x: p.pts[i - 1].x + (p.pts[i].x - p.pts[i - 1].x) * t,
        y: p.pts[i - 1].y + (p.pts[i].y - p.pts[i - 1].y) * t,
      }
    }
  }
  return p.pts[p.pts.length - 1]
}

function makeStreak(now: number, fast: boolean): Streak {
  const angle = fast ? rand(0.5, 1.1) : rand(0.1, 0.5)
  const fromLeft = Math.random() < 0.5
  const speed = fast ? rand(75, 110) : rand(5, 9)
  return {
    x: fromLeft ? rand(-20, 30) : rand(70, 120),
    y: rand(-20, 40),
    dx: (fromLeft ? 1 : -1) * Math.cos(angle) * speed,
    dy: Math.sin(angle) * speed,
    bornAt: now,
    lifeMs: fast ? rand(500, 800) : rand(9000, 14000),
    tail: fast ? 15 : 10,
  }
}

const canvasRef = useTemplateRef<HTMLCanvasElement>('canvas')

useElementCanvas(canvasRef, {
  init(_w, _h, now) {
    stars = Array.from({ length: 120 }, (_, i) => ({
      x: rand(-22, 122),
      y: rand(-22, 122),
      size: rand(0.5, 1.5),
      bright: i % 5 === 0,
      phase: rand(0, Math.PI * 2),
      speed: rand(0.8, 2.2),
    }))
    const nebulaColors = props.fill.nebulas.length > 0 ? props.fill.nebulas : [props.fill.accent]
    nebulas = stratifiedAngles(7).map((theta, k) => ({
      ...bandPoint(theta, 10, 96),
      r: rand(7, 13),
      color: nebulaColors[k % nebulaColors.length],
      phase: rand(0, Math.PI * 2),
    }))
    planets = props.fill.planets === false
      ? []
      : stratifiedAngles(4).map((theta, k) => ({
          ...bandPoint(theta, 12, 92),
          r: rand(1.8, 3),
          color: nebulaColors[(k + 1) % nebulaColors.length],
          ringed: k === 0,
        }))
    holes = props.fill.blackHoles === false
      ? []
      : stratifiedAngles(2).map((theta) => ({
          ...bandPoint(theta, 14, 90),
          r: rand(1.8, 2.2),
          tilt: rand(-0.5, 0.5),
        }))
    comet = null
    shooting = null
    nextCometAt = now + rand(2000, 8000)
    nextShootingAt = now + rand(1500, 5000)
    field = [
      ...stars.map((_, i): FieldElement => ({ kind: 'star', index: i, gone: false, respawnAt: 0, fadeInUntil: 0 })),
      ...nebulas.map((_, i): FieldElement => ({ kind: 'nebula', index: i, gone: false, respawnAt: 0, fadeInUntil: 0 })),
      ...planets.map((_, i): FieldElement => ({ kind: 'planet', index: i, gone: false, respawnAt: 0, fadeInUntil: 0 })),
    ]
    pulls = []
    nextPullAt = now + rand(800, 2000)
    lastNow = now
  },
  draw(ctx, w, h, now, reduced) {
    const { sx, sy, s, toX, toY } = overlaySpace(w, h, MARGIN)
    const t = now / 1000
    const dt = frameDelta(now, lastNow, reduced)
    lastNow = now

    ctx.fillStyle = props.fill.space
    ctx.fillRect(0, 0, w, h)

    const angle = reduced ? 0 : t * 0.07 * (props.fill.speed ?? 1)

    function elementAlpha(el: FieldElement): number {
      if (el.gone) return 0
      if (now < el.fadeInUntil) return 1 - (el.fadeInUntil - now) / 1000
      return 1
    }

    function drawStar(star: Star, px: number, py: number, alpha: number) {
      const tw = reduced ? 0.75 : 0.55 + 0.45 * Math.sin(t * star.speed + star.phase)
      const r = star.size * s
      if (star.bright) {
        const grad = ctx.createRadialGradient(px, py, 0, px, py, r * 3.5)
        grad.addColorStop(0, withAlpha(props.fill.star, 0.9 * tw * alpha))
        grad.addColorStop(1, withAlpha(props.fill.star, 0))
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(px, py, r * 3.5, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = (0.35 + 0.65 * tw) * alpha
      ctx.fillStyle = props.fill.star
      ctx.beginPath()
      ctx.arc(px, py, Math.max(0.5, r * 0.8), 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    function drawNebula(n: Nebula, px: number, py: number, alpha: number, radius = n.r * s) {
      const breathe = 0.28 + 0.1 * Math.sin(t * 0.4 + n.phase)
      const grad = ctx.createRadialGradient(px, py, 0, px, py, radius)
      grad.addColorStop(0, withAlpha(n.color, breathe * alpha))
      grad.addColorStop(1, withAlpha(n.color, 0))
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(px, py, radius, 0, Math.PI * 2)
      ctx.fill()
    }

    function drawPlanet(planet: Planet, px: number, py: number, alpha: number, radius = planet.r * s) {
      ctx.globalAlpha = alpha
      const grad = ctx.createRadialGradient(px - radius * 0.4, py - radius * 0.4, radius * 0.15, px, py, radius)
      grad.addColorStop(0, lighten(planet.color, 0.55))
      grad.addColorStop(0.7, planet.color)
      grad.addColorStop(1, darken(planet.color, 0.55))
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(px, py, radius, 0, Math.PI * 2)
      ctx.fill()
      if (planet.ringed) {
        ctx.strokeStyle = withAlpha(lighten(planet.color, 0.35), 0.8 * alpha)
        ctx.lineWidth = Math.max(0.6, radius * 0.22)
        ctx.beginPath()
        ctx.ellipse(px, py, radius * 1.8, radius * 0.55, -0.45, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    ctx.save()
    ctx.translate(toX(CENTER), toY(CENTER))
    ctx.rotate(angle)

    for (const el of field) {
      const alpha = elementAlpha(el)
      if (alpha <= 0) continue
      const raw = fieldPos(el)
      const px = (raw.x - CENTER) * sx
      const py = (raw.y - CENTER) * sy
      if (el.kind === 'star') drawStar(stars[el.index], px, py, alpha)
      else if (el.kind === 'nebula') drawNebula(nebulas[el.index], px, py, alpha)
      else drawPlanet(planets[el.index], px, py, alpha)
    }

    for (const hole of holes) {
      const px = (hole.x - CENTER) * sx
      const py = (hole.y - CENTER) * sy
      const r = hole.r * s
      const glow = ctx.createRadialGradient(px, py, r * 0.6, px, py, r * 2.4)
      glow.addColorStop(0, withAlpha(props.fill.accent, 0.5))
      glow.addColorStop(1, withAlpha(props.fill.accent, 0))
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(px, py, r * 2.4, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = withAlpha(lighten(props.fill.accent, 0.4), 0.95)
      ctx.lineWidth = Math.max(0.7, r * 0.28)
      ctx.beginPath()
      ctx.ellipse(px, py, r * 1.5, r * 0.5, hole.tilt, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = '#000000'
      ctx.beginPath()
      ctx.arc(px, py, r * 0.85, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()

    const sinkActive = !!props.sink && !reduced
    if (!sinkActive && pulls.length > 0) {
      for (const pull of pulls) {
        pull.el.gone = false
        pull.el.respawnAt = 0
        pull.el.fadeInUntil = 0
      }
      pulls = []
    }
    for (const el of field) {
      if (el.gone && el.respawnAt > 0 && now >= el.respawnAt) {
        el.gone = false
        el.respawnAt = 0
        el.fadeInUntil = now + 1000
      }
    }

    if (props.sink && sinkActive) {
      const sink = props.sink
      if (now >= nextPullAt && pulls.length < 3) {
        const candidates = field.filter((el) => !el.gone && now >= el.fadeInUntil)
        if (candidates.length > 0) {
          startPull(candidates[Math.floor(rand(0, candidates.length))], sink, angle)
        }
        nextPullAt = now + rand(1400, 2600)
      }
      for (const pull of pulls) {
        let pos: { x: number; y: number }
        let stretch = 0
        let alpha = 1
        if (pull.dist < pull.total) {
          pull.dist += 14 * (1 + (pull.dist / pull.total) * 2) * dt
          pos = routePoint(pull)
        } else {
          pull.spiralT = Math.min(1, pull.spiralT + (dt * 1000) / SPIRAL_MS)
          const a0 = pull.side > 0 ? -0.4 : Math.PI + 0.4
          const spiralAngle = a0 + pull.side * pull.spiralT * 6.5
          const radius = 15 * (1 - pull.spiralT) + sink.r * 0.7 * pull.spiralT
          const tilt = -0.35
          const ex = Math.cos(spiralAngle) * radius
          const ey = Math.sin(spiralAngle) * radius * 0.42
          pos = {
            x: sink.x + ex * Math.cos(tilt) - ey * Math.sin(tilt),
            y: sink.y + ex * Math.sin(tilt) + ey * Math.cos(tilt),
          }
          stretch = pull.spiralT
          alpha = 1 - pull.spiralT * 0.95
        }
        const px = toX(pos.x)
        const py = toY(pos.y)
        const dir = Math.atan2(sink.y - pos.y, sink.x - pos.x)
        ctx.save()
        ctx.translate(px, py)
        ctx.rotate(dir)
        ctx.scale(1 + stretch * 4, Math.max(0.2, 1 - stretch * 0.7))
        ctx.translate(-px, -py)
        if (pull.el.kind === 'star') drawStar(stars[pull.el.index], px, py, alpha)
        else if (pull.el.kind === 'nebula') drawNebula(nebulas[pull.el.index], px, py, alpha, nebulas[pull.el.index].r * s * 0.5)
        else drawPlanet(planets[pull.el.index], px, py, alpha, planets[pull.el.index].r * s * 0.8)
        ctx.restore()
        if (pull.spiralT >= 1) {
          pull.el.respawnAt = now + rand(6000, 11000)
        }
      }
      pulls = pulls.filter((pull) => pull.spiralT < 1)
    }

    if (!reduced) {
      if (props.fill.comets !== false) {
        if (!comet && now >= nextCometAt) comet = makeStreak(now, false)
        if (comet && now - comet.bornAt > comet.lifeMs) {
          comet = null
          nextCometAt = now + rand(12000, 24000)
        }
      }
      if (props.fill.shooting !== false) {
        if (!shooting && now >= nextShootingAt) shooting = makeStreak(now, true)
        if (shooting && now - shooting.bornAt > shooting.lifeMs) {
          shooting = null
          nextShootingAt = now + rand(3000, 8000)
        }
      }
      for (const streak of [comet, shooting]) {
        if (!streak) continue
        const age = (now - streak.bornAt) / 1000
        const hx = streak.x + streak.dx * age
        const hy = streak.y + streak.dy * age
        const p = (now - streak.bornAt) / streak.lifeMs
        const fade = Math.sin(Math.PI * Math.min(1, p))
        const len = Math.hypot(streak.dx, streak.dy)
        const tx = hx - (streak.dx / len) * streak.tail
        const ty = hy - (streak.dy / len) * streak.tail
        const grad = ctx.createLinearGradient(toX(hx), toY(hy), toX(tx), toY(ty))
        grad.addColorStop(0, withAlpha(props.fill.star, 0.9 * fade))
        grad.addColorStop(1, withAlpha(props.fill.accent, 0))
        ctx.strokeStyle = grad
        ctx.lineWidth = Math.max(0.8, 0.8 * s)
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(toX(hx), toY(hy))
        ctx.lineTo(toX(tx), toY(ty))
        ctx.stroke()
      }
    }
  },
})
</script>

<template>
  <canvas ref="canvas" class="cosmic-border-fill" aria-hidden="true" />
</template>

<style scoped>
.cosmic-border-fill {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  pointer-events: none;
}
</style>
