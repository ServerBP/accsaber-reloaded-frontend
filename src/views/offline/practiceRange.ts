import type { BackdropScene } from '@/composables/useBackdropCanvas'

export type RangeMode = 'zen' | 'game'
export type GameState = 'idle' | 'playing' | 'over'

export interface GameSnapshot {
  lives: number
  level: number
  score: number
  badCuts: number
  bombHits: number
  accuracy: number
}

export type RangeEvent =
  | { type: 'cut'; good: boolean; score: number }
  | { type: 'game'; snapshot: GameSnapshot }
  | { type: 'over'; snapshot: GameSnapshot }

export interface PracticeRangeScene extends BackdropScene {
  pointerMove(x: number, y: number, now: number): void
  pointerEnd(): void
  setMode(mode: RangeMode): void
  start(): void
}

interface Vec {
  x: number
  y: number
}

type TargetKind = 'bloq' | 'bomb' | 'heart'

interface Target {
  kind: TargetKind
  x: number
  baseY: number
  y: number
  size: number
  vx: number
  wobblePhase: number
  color: string
  dir: Vec | null
}

interface Half {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  spin: number
  size: number
  color: string
  dir: Vec | null
  cutAngle: number
  cutOff: number
  side: -1 | 1
  born: number
}

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  ttl: number
  size: number
  color: string
}

interface Pop {
  x: number
  y: number
  text: string
  color: string
  big: boolean
  born: number
}

interface TrailPoint {
  x: number
  y: number
  t: number
}

const GRAVITY = 1750
const SPARK_GRAVITY = 900
const HALF_TTL_MS = 700
const POP_TTL_MS = 650
const TRAIL_TTL_MS = 140
const SHAKE_TTL_MS = 260
const MIN_SWING_PX_PER_MS = 0.35
const MATCH_COS = Math.cos((65 * Math.PI) / 180)
const LANES = [0.32, 0.55, 0.78]

const MAX_LIVES = 3
const CUTS_PER_LEVEL = 8
const MAX_SPEED_MULT = 2.6
const MIN_SPAWN_MS = 380
const HEART_CHANCE = 0.05
const BOMB_CHANCE_BASE = 0.06
const BOMB_CHANCE_PER_LEVEL = 0.012
const BOMB_CHANCE_MAX = 0.15

const BLOQ_COLOR_TOKENS = [
  '--accent-true-acc',
  '--accent-standard-acc',
  '--accent-tech-acc',
  '--accent-low-mid',
  '--accent-overall',
]

const ARROW_DIRS: Vec[] = [
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
]
const ARROW_WEIGHTS = [0.5, 0.1, 0.2, 0.2]
const ARROW_CHANCE = 0.55

function readToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function pickArrowDir(): Vec {
  let pick = Math.random()
  for (let i = 0; i < ARROW_DIRS.length; i++) {
    if (pick < ARROW_WEIGHTS[i]) return ARROW_DIRS[i]
    pick -= ARROW_WEIGHTS[i]
  }
  return ARROW_DIRS[0]
}

function segmentDistance(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  const abx = bx - ax
  const aby = by - ay
  const lenSq = abx * abx + aby * aby
  if (lenSq === 0) return Math.hypot(px - ax, py - ay)
  const t = clamp(((px - ax) * abx + (py - ay) * aby) / lenSq, 0, 1)
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t))
}

function segmentHitsBox(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  half: number,
): boolean {
  const dx = bx - ax
  const dy = by - ay
  let t0 = 0
  let t1 = 1
  const p = [-dx, dx, -dy, dy]
  const q = [ax - (cx - half), cx + half - ax, ay - (cy - half), cy + half - ay]
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false
    } else {
      const r = q[i] / p[i]
      if (p[i] < 0) {
        if (r > t1) return false
        if (r > t0) t0 = r
      } else {
        if (r < t0) return false
        if (r < t1) t1 = r
      }
    }
  }
  return true
}

function segmentHitsTarget(t: Target, ax: number, ay: number, bx: number, by: number): boolean {
  if (t.kind === 'bloq') return segmentHitsBox(ax, ay, bx, by, t.x, t.y, t.size / 2)
  const radius = t.kind === 'bomb' ? t.size * 0.42 : t.size * 0.38
  return segmentDistance(ax, ay, bx, by, t.x, t.y) <= radius
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function heartPath(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath()
  ctx.moveTo(0, s * 0.38)
  ctx.bezierCurveTo(-s * 0.5, s * 0.02, -s * 0.34, -s * 0.38, 0, -s * 0.12)
  ctx.bezierCurveTo(s * 0.34, -s * 0.38, s * 0.5, s * 0.02, 0, s * 0.38)
  ctx.closePath()
}

export function createPracticeRange(onEvent: (ev: RangeEvent) => void): PracticeRangeScene {
  let width = 0
  let height = 0
  let lastNow = 0
  let nextSpawnAt = 0
  let lastLane = -1

  let mode: RangeMode = 'zen'
  let gameState: GameState = 'idle'
  let lives = MAX_LIVES
  let level = 1
  let score = 0
  let goodCuts = 0
  let badCuts = 0
  let bombHits = 0
  let missed = 0
  let shakeStart = -Infinity

  let targets: Target[] = []
  let halves: Half[] = []
  let sparks: Spark[] = []
  let pops: Pop[] = []
  let trail: TrailPoint[] = []

  let bloqColors: string[] = []
  let surfaceColor = ''
  let faceColor = ''
  let trailColor = ''
  let errorColor = ''
  let successColor = ''
  let mutedColor = ''

  function readPalette() {
    bloqColors = BLOQ_COLOR_TOKENS.map(readToken).filter(Boolean)
    surfaceColor = readToken('--bg-elevated')
    faceColor = readToken('--text-primary')
    trailColor = readToken('--accent') || readToken('--accent-overall')
    errorColor = readToken('--error')
    successColor = readToken('--success')
    mutedColor = readToken('--text-tertiary')
  }

  function accuracy(): number {
    const notes = goodCuts + badCuts + missed
    return notes > 0 ? (score / (115 * notes)) * 100 : 100
  }

  function snapshot(): GameSnapshot {
    return { lives, level, score, badCuts, bombHits, accuracy: accuracy() }
  }

  function emitGame() {
    onEvent({ type: 'game', snapshot: snapshot() })
  }

  function playing(): boolean {
    return mode === 'game' && gameState === 'playing'
  }

  function speedMult(): number {
    return mode === 'game' ? Math.min(1 + 0.15 * (level - 1), MAX_SPEED_MULT) : 1
  }

  function targetSize(): number {
    return clamp(width * 0.065, 44, 60)
  }

  function maxAlive(): number {
    if (mode === 'game') return Math.min(3 + Math.floor(level / 2), 8)
    return clamp(Math.round(width / 200), 3, 6)
  }

  function rollKind(): TargetKind {
    if (!playing()) return 'bloq'
    const roll = Math.random()
    if (lives < MAX_LIVES && roll < HEART_CHANCE) return 'heart'
    const bombChance = Math.min(BOMB_CHANCE_BASE + BOMB_CHANCE_PER_LEVEL * level, BOMB_CHANCE_MAX)
    if (roll < HEART_CHANCE + bombChance) return 'bomb'
    return 'bloq'
  }

  function makeTarget(x: number, lane: number, kind: TargetKind): Target {
    return {
      kind,
      x,
      baseY: LANES[lane] * height,
      y: LANES[lane] * height,
      size: targetSize(),
      vx: -clamp(width * (0.09 + Math.random() * 0.05), 70, 140) * speedMult(),
      wobblePhase: Math.random() * Math.PI * 2,
      color: bloqColors[Math.floor(Math.random() * bloqColors.length)],
      dir: kind === 'bloq' && Math.random() < ARROW_CHANCE ? pickArrowDir() : null,
    }
  }

  function spawnTarget(now: number) {
    const laneChoices = LANES.map((_, i) => i).filter((i) => i !== lastLane)
    const lane = laneChoices[Math.floor(Math.random() * laneChoices.length)]
    lastLane = lane
    targets.push(makeTarget(width + targetSize(), lane, rollKind()))
    const base = 750 + Math.random() * 350
    const delay = mode === 'game' ? Math.max(MIN_SPAWN_MS, base / (1 + 0.12 * (level - 1))) : base
    nextSpawnAt = now + delay
  }

  function addPop(x: number, y: number, text: string, color: string, big: boolean, now: number) {
    pops.push({ x, y, text, color, big, born: now })
  }

  function burstSparks(x: number, y: number, count: number, color: string) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 60 + Math.random() * 240
      sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        age: 0,
        ttl: 300 + Math.random() * 300,
        size: 1 + Math.random() * 1.5,
        color,
      })
    }
  }

  function loseLife(x: number, y: number, now: number) {
    lives -= 1
    shakeStart = now
    addPop(x, y, '-1', errorColor, false, now)
    if (lives <= 0) {
      gameState = 'over'
      targets = []
      onEvent({ type: 'over', snapshot: snapshot() })
    } else {
      emitGame()
    }
  }

  function gainLife(x: number, y: number, now: number) {
    lives = Math.min(MAX_LIVES, lives + 1)
    addPop(x, y, '+1', successColor, false, now)
    emitGame()
  }

  function registerCut(good: boolean, cutScore: number, now: number) {
    if (mode === 'zen') {
      onEvent({ type: 'cut', good, score: cutScore })
      return
    }
    if (!good) {
      badCuts += 1
      return
    }
    score += cutScore
    goodCuts += 1
    const nextLevel = 1 + Math.floor(goodCuts / CUTS_PER_LEVEL)
    if (nextLevel > level) {
      level = nextLevel
      addPop(width / 2, height * 0.24, `LEVEL ${level}`, trailColor, true, now)
    }
    emitGame()
  }

  function cutBloq(b: Target, from: TrailPoint, tx: number, ty: number, ux: number, uy: number, now: number) {
    const segLen = Math.hypot(tx - from.x, ty - from.y)
    const cross = (tx - from.x) * (b.y - from.y) - (ty - from.y) * (b.x - from.x)
    const signedOff = segLen > 0 ? cross / segLen : 0
    const good = !b.dir || ux * b.dir.x + uy * b.dir.y >= MATCH_COS
    const centering = clamp(Math.abs(signedOff) / (b.size / 2), 0, 1)
    const cutScore = good ? Math.round(115 - 15 * centering) : 0
    const power = good ? (cutScore - 100) / 15 : 0.25
    const cutAngle = Math.atan2(uy, ux)
    const nx = -uy
    const ny = ux
    const cutOff = clamp(-signedOff, -b.size * 0.4, b.size * 0.4)

    for (const side of [-1, 1] as const) {
      const push = (80 + 110 * power) * (0.8 + Math.random() * 0.4)
      halves.push({
        x: b.x,
        y: b.y,
        vx: nx * push * side + ux * 50,
        vy: ny * push * side - (90 + 130 * power) * (0.8 + Math.random() * 0.4),
        angle: 0,
        spin: side * (1.2 + Math.random() * 2.2),
        size: b.size,
        color: b.color,
        dir: b.dir,
        cutAngle,
        cutOff,
        side,
        born: now,
      })
    }

    const sparkColor = good ? b.color : mutedColor
    const count = good ? 14 + Math.round(12 * power) : 8
    for (let i = 0; i < count; i++) {
      const u = (Math.random() - 0.5) * b.size
      const side = Math.random() < 0.5 ? -1 : 1
      sparks.push({
        x: b.x + ux * u + nx * cutOff,
        y: b.y + uy * u + ny * cutOff,
        vx: nx * side * (60 + Math.random() * 240) * (0.6 + power * 0.7),
        vy: -60 + Math.random() * 200,
        age: 0,
        ttl: 260 + Math.random() * 300,
        size: 1 + Math.random() * 1.5,
        color: sparkColor,
      })
    }

    if (good) {
      addPop(
        b.x,
        b.y - b.size * 0.5,
        String(cutScore),
        cutScore >= 113 ? trailColor : faceColor,
        cutScore === 115,
        now,
      )
    } else if (mode === 'zen') {
      addPop(b.x, b.y - b.size * 0.5, '✕', errorColor, false, now)
    }
    registerCut(good, cutScore, now)
    if (!good && playing()) loseLife(b.x, b.y - b.size * 0.5, now)
  }

  function sliceTarget(t: Target, from: TrailPoint, tx: number, ty: number, ux: number, uy: number, now: number) {
    if (t.kind === 'bomb') {
      bombHits += 1
      burstSparks(t.x, t.y, 26, errorColor)
      loseLife(t.x, t.y - t.size * 0.5, now)
      return
    }
    if (t.kind === 'heart') {
      burstSparks(t.x, t.y, 18, successColor)
      gainLife(t.x, t.y - t.size * 0.5, now)
      return
    }
    cutBloq(t, from, tx, ty, ux, uy, now)
  }

  function update(dt: number, now: number) {
    for (const t of targets) {
      t.x += t.vx * dt
      t.y = t.baseY + Math.sin(t.wobblePhase + now * 0.0016) * 4
    }
    const escaped = targets.filter((t) => t.x <= -t.size)
    targets = targets.filter((t) => t.x > -t.size)
    if (playing()) {
      for (const t of escaped) {
        if (t.kind !== 'bloq') continue
        missed += 1
        loseLife(targetSize() * 0.8, t.y, now)
        if (gameState !== 'playing') break
      }
    }

    const spawning = mode === 'zen' || playing()
    if (spawning && now >= nextSpawnAt && targets.length < maxAlive()) spawnTarget(now)

    for (const h of halves) {
      h.vy += GRAVITY * dt
      h.x += h.vx * dt
      h.y += h.vy * dt
      h.angle += h.spin * dt
    }
    halves = halves.filter((h) => now - h.born < HALF_TTL_MS)

    for (const s of sparks) {
      s.age += dt * 1000
      s.vy += SPARK_GRAVITY * dt
      s.x += s.vx * dt
      s.y += s.vy * dt
    }
    sparks = sparks.filter((s) => s.age < s.ttl)

    pops = pops.filter((p) => now - p.born < POP_TTL_MS)
    trail = trail.filter((p) => now - p.t < TRAIL_TTL_MS)
  }

  function drawBloqBody(ctx: CanvasRenderingContext2D, size: number, color: string, dir: Vec | null) {
    const h = size / 2
    const r = size * 0.15
    roundRectPath(ctx, -h, -h, size, size, r)
    ctx.fillStyle = surfaceColor
    ctx.fill()
    ctx.globalAlpha = 0.22
    ctx.fillStyle = color
    ctx.fill()
    ctx.globalAlpha = 0.55
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.globalAlpha = 0.25
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-h + 3, h - 6)
    ctx.lineTo(-h + 3, -h + 3)
    ctx.lineTo(h - 6, -h + 3)
    ctx.stroke()
    ctx.globalAlpha = 1

    if (dir) {
      ctx.save()
      ctx.rotate(Math.atan2(dir.y, dir.x) - Math.PI / 2)
      ctx.strokeStyle = faceColor
      ctx.lineWidth = Math.max(2.5, size * 0.06)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(-size * 0.17, -size * 0.05)
      ctx.lineTo(0, size * 0.09)
      ctx.lineTo(size * 0.17, -size * 0.05)
      ctx.stroke()
      ctx.restore()
    } else {
      ctx.globalAlpha = 0.9
      ctx.fillStyle = faceColor
      ctx.beginPath()
      ctx.arc(0, 0, size * 0.09, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
  }

  function drawBombBody(ctx: CanvasRenderingContext2D, size: number) {
    const r = size * 0.34
    ctx.strokeStyle = errorColor
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r)
      ctx.lineTo(Math.cos(a) * (r + size * 0.13), Math.sin(a) * (r + size * 0.13))
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fillStyle = surfaceColor
    ctx.fill()
    ctx.globalAlpha = 0.8
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2)
    ctx.fillStyle = errorColor
    ctx.fill()
  }

  function drawHeartBody(ctx: CanvasRenderingContext2D, size: number) {
    heartPath(ctx, size * 0.9)
    ctx.fillStyle = surfaceColor
    ctx.fill()
    ctx.globalAlpha = 0.25
    ctx.fillStyle = successColor
    ctx.fill()
    ctx.globalAlpha = 0.85
    ctx.strokeStyle = successColor
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  function drawTarget(ctx: CanvasRenderingContext2D, t: Target) {
    ctx.save()
    ctx.translate(t.x, t.y)
    if (t.kind === 'bomb') drawBombBody(ctx, t.size)
    else if (t.kind === 'heart') drawHeartBody(ctx, t.size)
    else drawBloqBody(ctx, t.size, t.color, t.dir)
    ctx.restore()
  }

  function drawHalf(ctx: CanvasRenderingContext2D, h: Half, now: number) {
    const life = (now - h.born) / HALF_TTL_MS
    ctx.save()
    ctx.globalAlpha = life < 0.55 ? 1 : 1 - (life - 0.55) / 0.45
    ctx.translate(h.x, h.y)
    ctx.rotate(h.angle)
    ctx.rotate(h.cutAngle)
    const s = h.size
    ctx.beginPath()
    if (h.side < 0) ctx.rect(-s * 1.5, -s * 1.5, s * 3, s * 1.5 + h.cutOff)
    else ctx.rect(-s * 1.5, h.cutOff, s * 3, s * 1.5 - h.cutOff)
    ctx.clip()
    ctx.rotate(-h.cutAngle)
    drawBloqBody(ctx, s, h.color, h.dir)
    ctx.restore()
  }

  function drawSparks(ctx: CanvasRenderingContext2D) {
    for (const s of sparks) {
      const life = 1 - s.age / s.ttl
      ctx.globalAlpha = life
      ctx.strokeStyle = s.color
      ctx.lineWidth = s.size
      ctx.beginPath()
      ctx.moveTo(s.x, s.y)
      ctx.lineTo(s.x - s.vx * 0.02, s.y - s.vy * 0.02)
      ctx.stroke()
      ctx.globalAlpha = life * 0.5
      ctx.strokeStyle = faceColor
      ctx.lineWidth = Math.max(0.5, s.size - 1)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  function drawTrail(ctx: CanvasRenderingContext2D, now: number) {
    ctx.lineCap = 'round'
    ctx.strokeStyle = trailColor
    for (let i = 1; i < trail.length; i++) {
      const a = 1 - (now - trail[i].t) / TRAIL_TTL_MS
      ctx.globalAlpha = a * 0.8
      ctx.lineWidth = 1 + 2 * a
      ctx.beginPath()
      ctx.moveTo(trail[i - 1].x, trail[i - 1].y)
      ctx.lineTo(trail[i].x, trail[i].y)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  function drawPops(ctx: CanvasRenderingContext2D, now: number) {
    ctx.textAlign = 'center'
    for (const p of pops) {
      const t = (now - p.born) / POP_TTL_MS
      ctx.globalAlpha = 1 - t * t
      ctx.fillStyle = p.color
      ctx.font = p.big ? '600 17px Poppins, sans-serif' : '500 13px Poppins, sans-serif'
      ctx.fillText(p.text, p.x, p.y - 30 * (1 - Math.pow(1 - t, 3)))
    }
    ctx.globalAlpha = 1
  }

  function shakeOffset(now: number): Vec {
    const u = (now - shakeStart) / SHAKE_TTL_MS
    if (u < 0 || u >= 1) return { x: 0, y: 0 }
    const amp = 5 * Math.exp(-4 * u)
    return { x: amp * Math.sin(u * 32), y: amp * 0.6 * Math.sin(u * 47 + 1.3) }
  }

  return {
    init(w, h, now) {
      width = w
      height = h
      lastNow = now
      nextSpawnAt = now + 400
      lastLane = -1
      halves = []
      sparks = []
      pops = []
      trail = []
      readPalette()
      targets =
        mode === 'zen' ? [0, 1, 2].map((lane) => makeTarget(w * (0.3 + lane * 0.27), lane, 'bloq')) : []
    },

    draw(ctx, w, h, now, reduced) {
      ctx.clearRect(0, 0, w, h)
      if (reduced) {
        for (const t of targets) drawTarget(ctx, t)
        return
      }
      const dt = clamp((now - lastNow) / 1000, 0, 0.05)
      lastNow = now
      update(dt, now)
      const shake = shakeOffset(now)
      ctx.save()
      if (shake.x !== 0 || shake.y !== 0) ctx.translate(shake.x, shake.y)
      for (const t of targets) drawTarget(ctx, t)
      for (const half of halves) drawHalf(ctx, half, now)
      drawSparks(ctx)
      drawTrail(ctx, now)
      drawPops(ctx, now)
      ctx.restore()
    },

    pointerMove(x, y, now) {
      const prev = trail[trail.length - 1]
      trail.push({ x, y, t: now })
      if (!prev) return
      if (mode === 'game' && gameState !== 'playing') return
      const dx = x - prev.x
      const dy = y - prev.y
      const dtMs = now - prev.t
      const dist = Math.hypot(dx, dy)
      if (dtMs <= 0 || dist === 0 || dist / dtMs < MIN_SWING_PX_PER_MS) return
      const ux = dx / dist
      const uy = dy / dist
      for (let i = targets.length - 1; i >= 0; i--) {
        const t = targets[i]
        if (!segmentHitsTarget(t, prev.x, prev.y, x, y)) continue
        targets.splice(i, 1)
        sliceTarget(t, prev, x, y, ux, uy, now)
        if (mode === 'game' && gameState !== 'playing') break
      }
    },

    pointerEnd() {
      trail = []
    },

    setMode(next) {
      if (mode === next) return
      mode = next
      gameState = 'idle'
      targets = []
      halves = []
      pops = []
      if (mode === 'zen' && width > 0) {
        targets = [0, 1, 2].map((lane) => makeTarget(width * (0.3 + lane * 0.27), lane, 'bloq'))
      }
    },

    start() {
      if (mode !== 'game') return
      lives = MAX_LIVES
      level = 1
      score = 0
      goodCuts = 0
      badCuts = 0
      bombHits = 0
      missed = 0
      targets = []
      halves = []
      pops = []
      gameState = 'playing'
      nextSpawnAt = lastNow + 300
      emitGame()
    },
  }
}
