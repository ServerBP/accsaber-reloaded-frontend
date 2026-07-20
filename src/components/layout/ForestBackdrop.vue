<script setup lang="ts">
import { useBackdropCanvas } from '@/composables/useBackdropCanvas'
import { darken, lerpHex, lighten, parseHex } from '@/utils/color'
import { cell, drawDitheredBands } from '@/utils/pixelScene'
import { hash01, randBetween as rand } from '@/utils/random'
import type { ForestBackdropConfig } from '@/utils/themeBackdrop'
import { useTemplateRef } from 'vue'

const props = defineProps<{
  config: ForestBackdropConfig
}>()

interface Branch {
  row: number
  dir: number
  len: number
  leaf: boolean
}

interface Tree {
  side: number
  t: number
  col: number
  width: number
  top: number
  baseRow: number
  branches: Branch[]
  phase: number
  color: string
}

interface Mushroom {
  col: number
  baseRow: number
  capW: number
  cap: string
  pulseSpeed: number
  phase: number
  nextSporeAt: number
}

interface Wisp {
  x0: number
  y0: number
  vx: number
  ax: number
  ay: number
  fx: number
  fy: number
  p1: number
  p2: number
  bornAt: number
  lifeMs: number
  color: string
  core: string
}

interface Firefly {
  x: number
  y: number
  speed: number
  phase: number
}

interface Eye {
  col: number
  row: number
  gapCells: number
  color: string
  bornAt: number
  lifeMs: number
  blinkAt: number
}

interface Spore {
  x0: number
  y0: number
  bornAt: number
  lifeMs: number
  speed: number
  phase: number
  color: string
}

const TRAIL_ALPHA = [0, 0.45, 0.26, 0.12]

let cols = 0
let rows = 0
let vpRow = 0
let vpCol = 0
let pathHalfNear = 0
let trees: Tree[] = []
let mushrooms: Mushroom[] = []
let wisps: Wisp[] = []
let fireflies: Firefly[] = []
let eyes: Eye[] = []
let spores: Spore[] = []
let startTime = 0
let bg: HTMLCanvasElement | null = null

function fogColor(): string {
  return props.config.canopyColors[props.config.canopyColors.length - 1]
}

function groundRowAt(t: number): number {
  return Math.round(rows + 2 - (rows + 2 - (vpRow + 1)) * t)
}

function pathHalfAt(t: number): number {
  return Math.max(1, pathHalfNear * (1 - t) ** 1.1 + 1.2 * t)
}

function treeColorAt(t: number): string {
  const colors = props.config.treeColors
  const n = colors.length
  const pos = Math.min(1, Math.max(0, t)) * (n - 1)
  const i = Math.min(n - 2, Math.floor(pos))
  return lerpHex(colors[n - 1 - i], colors[Math.max(0, n - 2 - i)], pos - i)
}

function makeTree(side: number, t: number): Tree {
  const gap = 2 + (0.3 - 0.28 * t) * cols
  const col = Math.round(vpCol + side * (pathHalfAt(t) + gap + rand(-3, 3)))
  const width = Math.max(2, Math.round(19 - 16 * t + rand(-1, 1)))
  const baseRow = groundRowAt(t)
  const top = Math.round(baseRow - (rows * 1.5 - rows * 1.3 * t))
  const branches: Branch[] = []
  let row = Math.max(top + 5, 2) + Math.round(rand(0, 6))
  while (row < baseRow - Math.round(10 - 6 * t)) {
    branches.push({
      row,
      dir: Math.random() < 0.6 ? -side : side,
      len: Math.max(2, Math.round((10 - 7 * t) * rand(0.6, 1.15))),
      leaf: Math.random() < 0.75,
    })
    row += Math.round(rand(6, 13) * (1 - t * 0.4) + 3)
  }
  return { side, t, col, width, top, baseRow, branches, phase: rand(0, Math.PI * 2), color: treeColorAt(t) }
}

function makeMushroom(col: number, baseRow: number, capW: number, phase: number): Mushroom {
  const colors = props.config.mushroomColors
  return {
    col,
    baseRow,
    capW,
    cap: colors[Math.floor(Math.random() * colors.length)],
    pulseSpeed: rand(0.5, 1.0),
    phase,
    nextSporeAt: startTime + rand(1000, 6000),
  }
}

function makeWisp(w: number, h: number, bornAt: number): Wisp {
  const colors = props.config.wispColors
  const color = colors[Math.floor(Math.random() * colors.length)]
  const ps = props.config.pixelSize
  const spread = pathHalfNear * ps * 1.7
  return {
    x0: vpCol * ps + rand(-spread, spread),
    y0: rand(vpRow * ps * 1.05, h * 0.88),
    vx: rand(6, 14) * (Math.random() < 0.5 ? 1 : -1) * props.config.driftSpeed,
    ax: rand(18, 40),
    ay: rand(20, 45),
    fx: rand(0.15, 0.35),
    fy: rand(0.2, 0.5),
    p1: rand(0, Math.PI * 2),
    p2: rand(0, Math.PI * 2),
    bornAt,
    lifeMs: rand(12000, 20000),
    color,
    core: lighten(color, 0.65),
  }
}

function makeEye(now: number): Eye {
  const colors = props.config.eyeColors
  const side = Math.random() < 0.5 ? -1 : 1
  const t = rand(0.15, 0.6)
  const edge = vpCol + side * (pathHalfAt(t) + 4 + rand(0, (0.3 - 0.26 * t) * cols))
  return {
    col: Math.round(edge),
    row: groundRowAt(t) - Math.round(rand(3, 12)),
    gapCells: t < 0.3 ? 3 : 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    bornAt: now,
    lifeMs: rand(4000, 8000),
    blinkAt: now + rand(1500, 3500),
  }
}

function initScene(w: number, h: number, now: number) {
  const ps = props.config.pixelSize
  cols = Math.ceil(w / ps)
  rows = Math.ceil(h / ps)
  vpRow = Math.round(rows * 0.4)
  vpCol = Math.round(cols / 2)
  pathHalfNear = Math.round(cols * 0.13)
  bg = null

  trees = []
  const depths = [0.04, 0.22, 0.42, 0.62, 0.78]
  for (const side of [-1, 1]) {
    for (const d of depths) trees.push(makeTree(side, Math.min(0.95, d + rand(-0.04, 0.04))))
  }
  trees.sort((a, b) => b.t - a.t)

  mushrooms = []
  for (const tree of trees) {
    if (tree.t > 0.55 || Math.random() < 0.25) continue
    const capW = Math.max(3, Math.round(9 - 9 * tree.t))
    const count = tree.t < 0.25 ? 2 : 1
    for (let i = 0; i < count; i++) {
      const off = tree.side * Math.round(tree.width / 2 + capW / 2 + rand(0, 4)) * (i === 0 ? 1 : -1)
      mushrooms.push(makeMushroom(tree.col + off, tree.baseRow, capW, rand(0, Math.PI * 2)))
    }
  }
  const guideDepths = [0.12, 0.3, 0.48, 0.66]
  for (const side of [-1, 1]) {
    for (const d of guideDepths) {
      const t = Math.min(0.9, d + rand(-0.03, 0.03))
      const col = Math.round(vpCol + side * (pathHalfAt(t) + rand(1, 3)))
      mushrooms.push(makeMushroom(col, groundRowAt(t), t < 0.4 ? 3 : 2, 5 - t * 5))
    }
  }

  wisps = []
  const wispCount = Math.max(2, Math.round(w / 500))
  for (let i = 0; i < wispCount; i++) wisps.push(makeWisp(w, h, now - rand(2000, 9000)))

  fireflies = []
  const flyCount = Math.max(4, Math.round(w / 130))
  for (let i = 0; i < flyCount; i++) {
    const side = Math.random() < 0.5 ? -1 : 1
    fireflies.push({
      x: vpCol * ps + side * rand(pathHalfNear * ps * 0.6, w * 0.48),
      y: rand(h * 0.3, h * 0.92),
      speed: rand(0.4, 1.2),
      phase: rand(0, Math.PI * 2),
    })
  }

  eyes = []
  if (props.config.eyes) {
    eyes.push(makeEye(now - rand(0, 3000)))
    eyes.push(makeEye(now - rand(0, 3000)))
  }
  spores = []
}

function drawFoliage(
  ctx: CanvasRenderingContext2D,
  colC: number,
  rowC: number,
  ps: number,
  radius: number,
  color: string,
  seed: number,
) {
  const r2 = radius * radius
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const d2 = dx * dx + dy * dy * 2.6
      if (d2 > r2) continue
      if (hash01(seed + dx * 31 + dy * 61) < 0.75 - (d2 / r2) * 0.5) {
        cell(ctx, colC + dx, rowC + dy, ps, color)
      }
    }
  }
}

function drawTree(ctx: CanvasRenderingContext2D, tree: Tree, ps: number) {
  const leafColor = darken(tree.color, 0.18)
  for (const b of tree.branches) {
    const offset = Math.round(Math.sin(b.row * 0.05 + tree.phase) * (1 - tree.t) * 2)
    const half = Math.floor(tree.width / 2)
    const start = tree.col + offset + b.dir * half
    const thick = tree.t < 0.3 ? 2 : 1
    for (let i = 0; i < b.len; i++) {
      const rise = Math.floor((i / b.len) * (b.len > 5 ? 3 : 1))
      for (let k = 0; k < thick; k++) cell(ctx, start + b.dir * i, b.row - rise + k, ps, tree.color)
    }
    if (b.leaf) {
      const endCol = start + b.dir * b.len
      const endRow = b.row - (b.len > 5 ? 3 : 1)
      drawFoliage(ctx, endCol, endRow, ps, Math.max(2, Math.round(6 - 4 * tree.t)), leafColor, endCol * 97 + endRow * 13)
    }
  }
  const half = Math.floor(tree.width / 2)
  const streakShade = darken(tree.color, 0.22)
  const streakLight = lighten(tree.color, 0.05)
  for (let row = Math.max(tree.top, -2); row <= tree.baseRow; row++) {
    const offset = Math.round(Math.sin(row * 0.05 + tree.phase) * (1 - tree.t) * 2)
    for (let i = -half; i < tree.width - half; i++) {
      const col = tree.col + offset + i
      let c = tree.color
      if (tree.t < 0.35) {
        const streak = hash01(i * 29 + tree.col * 7)
        if (streak < 0.22) c = streakShade
        else if (streak > 0.86) c = streakLight
        if (i === -half || i === -half + 1) c = lighten(tree.color, 0.08)
        if (i === tree.width - half - 1 || i === tree.width - half - 2) c = darken(tree.color, 0.3)
        if (hash01(col * 57 + row * 13) < 0.05) c = darken(tree.color, 0.38)
      }
      cell(ctx, col, row, ps, c)
    }
  }
  const rootHalf = half + 1
  for (let i = -rootHalf; i <= rootHalf; i += rootHalf === 1 ? 1 : 2) {
    cell(ctx, tree.col + i, tree.baseRow, ps, tree.color)
    cell(ctx, tree.col + i, tree.baseRow + 1, ps, darken(tree.color, 0.15))
  }
}

function drawMushroomBody(ctx: CanvasRenderingContext2D, m: Mushroom, ps: number) {
  const capH = Math.max(1, Math.round(m.capW / 3))
  const stemH = Math.max(1, Math.round(m.capW / 3))
  const stemW = Math.max(1, Math.round(m.capW / 4))
  const capTop = m.baseRow - stemH - capH
  const stem = darken(m.cap, 0.5)
  const top = lighten(m.cap, 0.35)
  const half = Math.floor(m.capW / 2)
  for (let r = 0; r < stemH; r++) {
    for (let i = 0; i < stemW; i++) cell(ctx, m.col - Math.floor(stemW / 2) + i, m.baseRow - 1 - r, ps, stem)
  }
  for (let r = 0; r < capH; r++) {
    const rowW = r === 0 && capH > 1 ? m.capW - 2 : m.capW
    const rowHalf = Math.floor(rowW / 2)
    for (let i = -rowHalf; i <= rowHalf; i++) {
      cell(ctx, m.col + i, capTop + r, ps, r === 0 ? top : m.cap)
    }
  }
  if (m.capW >= 5) {
    cell(ctx, m.col - half + 1, capTop + capH - 1, ps, top)
    cell(ctx, m.col + half - 1, capTop + capH - 1, ps, top)
    if (m.capW >= 7) cell(ctx, m.col, capTop + capH - 1, ps, top)
  }
}

function bloom(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  hex: string,
  alpha: number,
) {
  const rgb = parseHex(hex)
  if (!rgb) return
  const [r, g, b] = rgb
  const grad = ctx.createRadialGradient(x, y, 0, x, y, radius)
  grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`)
  grad.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, ${alpha * 0.35})`)
  grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
  ctx.fillStyle = grad
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
}

function drawGlow(
  ctx: CanvasRenderingContext2D,
  colC: number,
  rowC: number,
  ps: number,
  radius: number,
  color: string,
  intensity: number,
  seed: number,
  skip?: (dx: number, dy: number) => boolean,
) {
  const r2 = radius * radius
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const d2 = dx * dx + dy * dy
      if (d2 > r2 || (skip && skip(dx, dy))) continue
      const density = intensity * Math.max(0, 1 - d2 / r2) * 9
      if (hash01(seed + dx * 31 + dy * 61) * 10 < density) {
        cell(ctx, colC + dx, rowC + dy, ps, color)
      }
    }
  }
}

function drawMushroomGlows(ctx: CanvasRenderingContext2D, ps: number, elapsed: number, reduced: boolean) {
  const fog = fogColor()
  for (const m of mushrooms) {
    const pulse = reduced ? 0.85 : 0.65 + 0.35 * Math.sin(elapsed * m.pulseSpeed + m.phase)
    const shimmer = reduced ? 0 : Math.floor(elapsed * 1.5) % 3
    const capH = Math.max(1, Math.round(m.capW / 3))
    const stemH = Math.max(1, Math.round(m.capW / 3))
    const centerRow = m.baseRow - stemH - capH
    const radius = Math.max(4, Math.round(m.capW * 1.3))
    const glow = lerpHex(fog, m.cap, 0.5)
    const half = Math.floor(m.capW / 2)
    if (props.config.bloom) {
      bloom(ctx, m.col * ps, centerRow * ps, m.capW * 2.4 * ps, m.cap, 0.13 * pulse)
    }
    drawGlow(ctx, m.col, centerRow, ps, radius, glow, pulse, m.col * 97 + shimmer * 7,
      (dx, dy) => dy >= 0 && dy <= capH + stemH && Math.abs(dx) <= half)
    const pool = lerpHex(props.config.groundColors[1], m.cap, 0.3)
    drawGlow(ctx, m.col, m.baseRow + 1, ps, Math.max(2, half + 1), pool, pulse * 0.8,
      m.col * 53 + shimmer * 11, (dx, dy) => dy < 0)
  }
}

function drawSpores(ctx: CanvasRenderingContext2D, ps: number, now: number) {
  spores = spores.filter((s) => now - s.bornAt < s.lifeMs)
  for (const m of mushrooms) {
    if (m.capW < 3 || now < m.nextSporeAt) continue
    spores.push({
      x0: m.col * ps + rand(-ps, ps),
      y0: (m.baseRow - Math.round(m.capW * 0.7)) * ps,
      bornAt: now,
      lifeMs: rand(4000, 7000),
      speed: rand(5, 9),
      phase: rand(0, Math.PI * 2),
      color: lighten(m.cap, 0.4),
    })
    m.nextSporeAt = now + rand(3000, 9000)
  }
  for (const s of spores) {
    const t = (now - s.bornAt) / 1000
    const p = (now - s.bornAt) / s.lifeMs
    if (hash01(Math.floor(s.x0) * 13 + Math.floor(t * 8)) < p * 0.7) continue
    const col = Math.round((s.x0 + Math.sin(t * 1.3 + s.phase) * 6) / ps)
    const row = Math.round((s.y0 - t * s.speed) / ps)
    cell(ctx, col, row, ps, s.color)
  }
}

function wispPos(wp: Wisp, now: number): { x: number; y: number } {
  const t = (now - wp.bornAt) / 1000
  return {
    x: wp.x0 + wp.vx * t + Math.sin(t * wp.fx + wp.p1) * wp.ax,
    y: wp.y0 + Math.sin(t * wp.fy + wp.p2) * wp.ay + Math.sin(t * 0.31 + wp.p1) * 8,
  }
}

function drawWisps(ctx: CanvasRenderingContext2D, w: number, h: number, ps: number, now: number, reduced: boolean) {
  const fog = fogColor()
  for (let i = 0; i < wisps.length; i++) {
    let wp = wisps[i]
    const age = now - wp.bornAt
    if (!reduced && age > wp.lifeMs) {
      wp = wisps[i] = makeWisp(w, h, now)
    }
    const a = reduced ? 1 : Math.min(1, age / 1200, (wp.lifeMs - age) / 1800)
    if (a <= 0) continue
    const glow = lerpHex(fog, wp.color, 0.5)
    for (let k = 3; k >= 1; k--) {
      const past = wispPos(wp, now - k * 220)
      ctx.globalAlpha = a * TRAIL_ALPHA[k]
      cell(ctx, Math.round(past.x / ps), Math.round(past.y / ps), ps, wp.color)
    }
    const pos = wispPos(wp, now)
    const depth = Math.min(1, Math.max(0.35, (pos.y / h - 0.3) * 1.6))
    const col = Math.round(pos.x / ps)
    const row = Math.round(pos.y / ps)
    ctx.globalAlpha = a
    if (props.config.bloom) bloom(ctx, pos.x, pos.y, 9 * depth * ps, wp.color, 0.2)
    const shimmer = reduced ? 0 : Math.floor((now - startTime) / 250) % 3
    drawGlow(ctx, col, row, ps, Math.round(5 * depth), glow, 0.9, i * 131 + shimmer * 17,
      (dx, dy) => dx >= 0 && dx <= 1 && dy >= 0 && dy <= 1)
    cell(ctx, col, row, ps, wp.core)
    cell(ctx, col + 1, row, ps, wp.color)
    cell(ctx, col, row + 1, ps, wp.color)
    cell(ctx, col + 1, row + 1, ps, wp.core)
    ctx.globalAlpha = 1
  }
}

function drawFireflies(ctx: CanvasRenderingContext2D, ps: number, elapsed: number) {
  const dim = lerpHex(fogColor(), props.config.fireflyColor, 0.4)
  for (const f of fireflies) {
    const gate = Math.sin(elapsed * f.speed + f.phase)
    if (gate <= 0) continue
    const a = Math.min(1, gate * 1.4)
    const col = Math.round((f.x + Math.sin(elapsed * 0.5 + f.phase) * 6) / ps)
    const row = Math.round((f.y + Math.cos(elapsed * 0.4 + f.phase) * 4) / ps)
    ctx.globalAlpha = a
    if (props.config.bloom && gate > 0.5) {
      bloom(ctx, col * ps, row * ps, 3.5 * ps, props.config.fireflyColor, 0.16)
    }
    cell(ctx, col, row, ps, props.config.fireflyColor)
    if (gate > 0.65) {
      cell(ctx, col - 1, row, ps, dim)
      cell(ctx, col + 1, row, ps, dim)
      cell(ctx, col, row - 1, ps, dim)
      cell(ctx, col, row + 1, ps, dim)
    }
    ctx.globalAlpha = 1
  }
}

function drawEyes(ctx: CanvasRenderingContext2D, ps: number, now: number, reduced: boolean) {
  for (let i = 0; i < eyes.length; i++) {
    let e = eyes[i]
    const age = now - e.bornAt
    if (!reduced && age > e.lifeMs) {
      e = eyes[i] = makeEye(now + rand(2000, 9000))
      continue
    }
    if (age < 0) continue
    let a = reduced ? 0.9 : Math.min(1, age / 800, (e.lifeMs - age) / 800)
    if (a <= 0) continue
    if (!reduced && now >= e.blinkAt) {
      if (now < e.blinkAt + 160) a = 0
      else e.blinkAt = now + rand(1200, 3000)
    }
    ctx.globalAlpha = a * 0.9
    cell(ctx, e.col, e.row, ps, e.color)
    cell(ctx, e.col + e.gapCells, e.row, ps, e.color)
    if (e.gapCells > 2) {
      ctx.globalAlpha = a * 0.35
      cell(ctx, e.col, e.row + 1, ps, e.color)
      cell(ctx, e.col + e.gapCells, e.row + 1, ps, e.color)
    }
    ctx.globalAlpha = 1
  }
}

function drawPath(ctx: CanvasRenderingContext2D, ps: number) {
  const fog = fogColor()
  for (let row = vpRow + 1; row <= rows; row++) {
    const t = (rows - row) / (rows - vpRow)
    const half = pathHalfAt(t)
    const c = lerpHex(props.config.pathColor, fog, t * 0.75)
    const from = Math.round(vpCol - half) - Math.round(hash01(row * 13) * 2)
    const to = Math.round(vpCol + half) + Math.round(hash01(row * 29) * 2)
    ctx.fillStyle = c
    ctx.fillRect(from * ps, row * ps, (to - from + 1) * ps, ps)
    if (hash01(row * 41) < 0.55) cell(ctx, from - 1, row, ps, c)
    if (hash01(row * 53) < 0.55) cell(ctx, to + 1, row, ps, c)
    const g = props.config.groundColors[Math.floor(hash01(row * 17) * props.config.groundColors.length)]
    if (hash01(row * 61) < 0.4) cell(ctx, from + 1, row, ps, g)
    if (hash01(row * 71) < 0.4) cell(ctx, to - 1, row, ps, g)
  }
}

function buildBackground(ctx: CanvasRenderingContext2D): HTMLCanvasElement {
  const ps = props.config.pixelSize
  const off = document.createElement('canvas')
  off.width = ctx.canvas.width
  off.height = ctx.canvas.height
  const octx = off.getContext('2d')
  if (!octx) return off
  const tr = ctx.getTransform()
  octx.setTransform(tr.a, tr.b, tr.c, tr.d, 0, 0)

  const fog = fogColor()
  drawDitheredBands(octx, cols, ps, props.config.canopyColors, 0, vpRow)
  const farGround = lerpHex(props.config.groundColors[0], fog, 0.55)
  drawDitheredBands(octx, cols, ps, [farGround, ...props.config.groundColors], vpRow, rows)

  for (let row = vpRow - 3; row < vpRow + 6; row++) {
    const p = 0.5 - Math.abs(row - vpRow - 1) * 0.11
    for (let col = 0; col < cols; col++) {
      if (hash01(col * 37 + row * 71) < p) {
        cell(octx, col, row, ps, row < vpRow + 1 ? farGround : fog)
      }
    }
  }

  for (let row = vpRow + 1; row < rows; row++) {
    const t = (rows - row) / (rows - vpRow)
    const density = 0.09 * (1 - t) + 0.015
    for (let col = 0; col < cols; col++) {
      if (hash01(col * 31 + row * 57) < density) {
        cell(octx, col, row, ps, lighten(props.config.groundColors[2], 0.07))
      }
    }
  }

  drawPath(octx, ps)

  for (const tree of trees) drawTree(octx, tree, ps)

  const glowColor = lerpHex(fog, props.config.wispColors[0], 0.4)
  if (props.config.bloom) {
    bloom(octx, vpCol * ps, (vpRow + 1) * ps, 22 * ps, props.config.wispColors[0], 0.16)
  }
  const r2 = 15 * 15
  for (let dy = -10; dy <= 12; dy++) {
    for (let dx = -15; dx <= 15; dx++) {
      const d2 = dx * dx + dy * dy * 2.2
      if (d2 > r2) continue
      const density = 0.8 * Math.max(0, 1 - d2 / r2) * 9
      if (hash01(999 + dx * 31 + dy * 61) * 10 < density) {
        cell(octx, vpCol + dx, vpRow + dy, ps, glowColor)
      }
    }
  }

  for (const m of mushrooms) drawMushroomBody(octx, m, ps)
  return off
}

const canvasRef = useTemplateRef<HTMLCanvasElement>('canvas')

useBackdropCanvas(canvasRef, {
  init(w, h, now) {
    startTime = now
    initScene(w, h, now)
  },
  draw(ctx, w, h, now, reduced) {
    const ps = props.config.pixelSize
    if (!bg) bg = buildBackground(ctx)
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.drawImage(bg, 0, 0)
    ctx.restore()
    const elapsed = (now - startTime) / 1000
    drawMushroomGlows(ctx, ps, elapsed, reduced)
    if (props.config.wisps) drawWisps(ctx, w, h, ps, now, reduced)
    if (props.config.fireflies) drawFireflies(ctx, ps, elapsed)
    if (props.config.eyes) drawEyes(ctx, ps, now, reduced)
    if (reduced) return
    if (props.config.spores) drawSpores(ctx, ps, now)
  },
})
</script>

<template>
  <canvas
    ref="canvas"
    class="forest-backdrop"
    :style="{ opacity: config.opacity }"
    aria-hidden="true"
  />
</template>

<style scoped>
.forest-backdrop {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
  pointer-events: none;
}
</style>
