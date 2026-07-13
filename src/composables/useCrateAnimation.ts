import type {
  CrateContentResponse,
  CrateModifierResponse,
  ItemModifierRef,
  ItemModifierResponse,
  ItemResponse,
  UnusualEffectRef,
} from '@/types/api/items'
import { createCrateRoller, type CrateRoll } from '@/utils/crateRoll'
import { RARITY_ORDER } from '@/utils/items'
import { nextTick, onUnmounted, ref, type Ref } from 'vue'

export type CratePhase =
  | 'idle'
  | 'ready'
  | 'spinning'
  | 'landed'
  | 'slicing'
  | 'revealing'
  | 'revealed'

export interface CrateHalfMotion {
  x: number
  y: number
  angle: number
  opacity: number
}

interface HalfBody {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  va: number
}

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  ttl: number
  size: number
}

interface UseCrateAnimationOptions {
  result: Ref<ItemResponse | null>
  resultModifiers: Ref<ItemModifierRef[]>
  resultUnusualEffect: Ref<UnusualEffectRef | null>
  contents: Ref<CrateContentResponse[]>
  crateModifiers: Ref<CrateModifierResponse[]>
  globalModifiers: Ref<ItemModifierResponse[]>
  unusualEffects: Ref<UnusualEffectRef[]>
  cardWidth: Ref<number>
  cardHeight: Ref<number>
  cardGap: Ref<number>
  carouselLength: Ref<number>
  spinDurationMs: Ref<number>
  stageEl: Ref<HTMLElement | null>
  sparksEl: Ref<HTMLCanvasElement | null>
  onTick?: (progress: number) => void
  onLand?: () => void
  onSwing?: () => void
  onSlice?: (score01: number) => void
  onReveal?: () => void
  onComplete?: () => void
  onSkip?: () => void
}

const TIMING = {
  landedHold: 430,
  bladeLead: 80,
  halvesLife: 720,
  revealDelay: 400,
  revealIn: 340,
  shake: 240,
} as const

export const CRATE_PHASE_DURATIONS = TIMING

const GRAVITY = 1750
const SPARK_GRAVITY = 900
const IDLE_HALF: CrateHalfMotion = { x: 0, y: 0, angle: 0, opacity: 0 }

const RARITY_TOKEN: Record<string, string> = {
  common: '--text-tertiary',
  uncommon: '--success',
  rare: '--info',
  epic: '--tier-apex',
  legendary: '--tier-gold',
  mythic: '--error',
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function easeOutQuint(t: number): number {
  return 1 - Math.pow(1 - t, 5)
}

const MAX_PRELOAD_MS = 600

function raf(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function decodeImages(urls: string[]): Promise<unknown> {
  return Promise.all(
    urls.map((src) => {
      const img = new Image()
      img.src = src
      return img.decode().catch(() => undefined)
    }),
  )
}

function rarityCssColor(rarity: string): string {
  const token = RARITY_TOKEN[rarity] ?? '--text-tertiary'
  return (
    getComputedStyle(document.documentElement).getPropertyValue(token).trim() || '#ffffff'
  )
}

export function useCrateAnimation(opts: UseCrateAnimationOptions) {
  const phase = ref<CratePhase>('idle')
  const carousel = ref<CrateRoll[]>([])
  const landingIndex = ref(0)
  const carouselOffset = ref(0)
  const armed = ref(false)
  const cutPct = ref(0.5)
  const cutShiftPct = ref(0)
  const bladeTiltDeg = ref(0)
  const hitScore = ref(115)
  const halvesActive = ref(false)
  const halfLeft = ref<CrateHalfMotion>(IDLE_HALF)
  const halfRight = ref<CrateHalfMotion>(IDLE_HALF)
  const shakeX = ref(0)
  const shakeY = ref(0)
  const scoreVisible = ref(false)

  let rafId = 0
  let playSeq = 0
  let startAt = 0
  let lastFrameAt = 0
  let targetOffset = 0
  let lastTickIndex = -1
  let stageW = 640
  let stageH = 260
  let cutReleased = false
  let revealBurstFired = false
  let leftBody: HalfBody | null = null
  let rightBody: HalfBody | null = null
  let sparks: Spark[] = []
  let sparkColor = '#ffffff'
  let sparkCtx: CanvasRenderingContext2D | null = null

  function anchors() {
    const spin = opts.spinDurationMs.value
    const land = spin
    const swing = land + TIMING.landedHold
    const cut = swing + TIMING.bladeLead
    const reveal = cut + TIMING.revealDelay
    const done = reveal + TIMING.revealIn
    return { spin, land, swing, cut, reveal, done }
  }

  function stopLoop() {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
  }

  function clearSparksCanvas() {
    const canvas = opts.sparksEl.value
    sparkCtx?.clearRect(0, 0, canvas?.width ?? 0, canvas?.height ?? 0)
  }

  function resetEffects() {
    halvesActive.value = false
    scoreVisible.value = false
    shakeX.value = 0
    shakeY.value = 0
    halfLeft.value = IDLE_HALF
    halfRight.value = IDLE_HALF
    leftBody = null
    rightBody = null
    sparks = []
    cutReleased = false
    revealBurstFired = false
    lastTickIndex = -1
    clearSparksCanvas()
  }

  function buildCarousel(winner: CrateRoll): CrateRoll[] {
    const len = opts.carouselLength.value
    const roll = createCrateRoller({
      contents: opts.contents.value,
      crateModifiers: opts.crateModifiers.value,
      globalModifiers: opts.globalModifiers.value,
      unusualEffects: opts.unusualEffects.value,
    })
    const landing = Math.max(0, len - 6)
    const slots: (CrateRoll | undefined)[] = new Array(len)
    slots[landing] = winner
    for (let i = 0; i < len; i++) {
      if (i === landing) continue
      const exclude = new Set<string>()
      const prev = i > 0 ? slots[i - 1] : undefined
      const next = slots[i + 1]
      if (prev) exclude.add(prev.item.id)
      if (next) exclude.add(next.item.id)
      slots[i] = roll(exclude) ?? winner
    }
    landingIndex.value = landing
    return slots as CrateRoll[]
  }

  function measureStage() {
    const stage = opts.stageEl.value
    stageW = stage?.clientWidth ?? 640
    stageH = stage?.clientHeight ?? 260
    const canvas = opts.sparksEl.value
    if (!canvas) {
      sparkCtx = null
      return
    }
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(stageW * dpr)
    canvas.height = Math.round(stageH * dpr)
    sparkCtx = canvas.getContext('2d')
    sparkCtx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function rollGeometry() {
    const cardW = opts.cardWidth.value
    const cardH = opts.cardHeight.value
    const cardTotal = cardW + opts.cardGap.value
    const centerOffset =
      -(landingIndex.value * cardTotal) + stageW / 2 - cardW / 2
    const innerMargin = Math.min(18, cardW * 0.15)
    const maxJitter = cardW / 2 - innerMargin
    const jitter = (Math.random() * 2 - 1) * maxJitter
    targetOffset = centerOffset + jitter
    cutPct.value = clamp(0.5 - jitter / cardW, 0, 1)
    const normalizedMiss = maxJitter > 0 ? Math.min(1, Math.abs(jitter) / maxJitter) : 0
    hitScore.value = Math.round(100 + 15 * (1 - normalizedMiss))
    const edgeRoom = Math.min(cutPct.value, 1 - cutPct.value) * 100 - 3
    const shift = (Math.random() * 2 - 1) * Math.min(8, Math.max(0, edgeRoom))
    cutShiftPct.value = shift
    bladeTiltDeg.value = (-Math.atan((2 * shift * cardW) / (100 * cardH)) * 180) / Math.PI
  }

  function score01(): number {
    return (hitScore.value - 100) / 15
  }

  function reticleIndex(offset: number): number {
    const cardTotal = opts.cardWidth.value + opts.cardGap.value
    return Math.floor((stageW / 2 - offset) / cardTotal)
  }

  function sampleOffset(t: number, spin: number): number {
    return targetOffset * easeOutQuint(clamp(t / spin, 0, 1))
  }

  function detectTicks(t: number, spin: number) {
    const index = reticleIndex(carouselOffset.value)
    if (index > lastTickIndex) {
      lastTickIndex = index
      opts.onTick?.(clamp(t / spin, 0, 1))
    }
  }

  function releaseHalves() {
    const power = score01()
    const leftFrac = cutPct.value
    const smallLeft = leftFrac <= 0.5
    const asym = (0.5 - Math.min(leftFrac, 1 - leftFrac)) * 2
    const push = 70 + 130 * power
    const boost = 1 + asym * 0.9
    const vy = 90 + 150 * power
    leftBody = {
      x: 0,
      y: 0,
      vx: -push * (smallLeft ? boost : 1) * (0.8 + Math.random() * 0.4),
      vy: vy * (0.8 + Math.random() * 0.4),
      angle: 0,
      va: -(55 + Math.random() * 110) * (smallLeft ? boost : 1),
    }
    rightBody = {
      x: 0,
      y: 0,
      vx: push * (smallLeft ? 1 : boost) * (0.8 + Math.random() * 0.4),
      vy: vy * (0.8 + Math.random() * 0.4),
      angle: 0,
      va: (55 + Math.random() * 110) * (smallLeft ? 1 : boost),
    }
    halvesActive.value = true
    scoreVisible.value = true
    spawnCutSparks()
    opts.onSlice?.(power)
  }

  function spawnCutSparks() {
    const power = score01()
    const cardH = opts.cardHeight.value
    const cardW = opts.cardWidth.value
    const cutShiftPx = (cutShiftPct.value / 100) * cardW
    const count = 18 + Math.round(14 * power)
    for (let i = 0; i < count; i++) {
      const yr = Math.random() - 0.5
      const dir = Math.random() < 0.5 ? -1 : 1
      sparks.push({
        x: stageW / 2 + yr * 2 * cutShiftPx,
        y: stageH / 2 + yr * cardH * 0.9,
        vx: dir * (40 + Math.random() * 260) * (0.6 + power * 0.7),
        vy: -60 + Math.random() * 220,
        age: 0,
        ttl: 260 + Math.random() * 300,
        size: 1 + Math.random() * 1.6,
      })
    }
  }

  function spawnRevealBurst() {
    for (let i = 0; i < 26; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 60 + Math.random() * 260
      sparks.push({
        x: stageW / 2,
        y: stageH / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        age: 0,
        ttl: 400 + Math.random() * 300,
        size: 1 + Math.random() * 1.4,
      })
    }
  }

  function updateHalves(dt: number, t: number, cutAt: number) {
    if (!leftBody || !rightBody) return
    const life = clamp((t - cutAt) / TIMING.halvesLife, 0, 1)
    for (const body of [leftBody, rightBody]) {
      body.vy += GRAVITY * dt
      body.x += body.vx * dt
      body.y += body.vy * dt
      body.angle += body.va * dt
    }
    const opacity = life < 0.55 ? 1 : 1 - (life - 0.55) / 0.45
    halfLeft.value = { x: leftBody.x, y: leftBody.y, angle: leftBody.angle, opacity }
    halfRight.value = { x: rightBody.x, y: rightBody.y, angle: rightBody.angle, opacity }
    if (life >= 1) {
      halvesActive.value = false
      leftBody = null
      rightBody = null
    }
  }

  function updateShake(t: number, cutAt: number) {
    const u = (t - cutAt) / TIMING.shake
    if (u < 0 || u >= 1) {
      shakeX.value = 0
      shakeY.value = 0
      return
    }
    const amp = (1.5 + 3.5 * score01()) * Math.exp(-4 * u)
    shakeX.value = amp * Math.sin(u * 32)
    shakeY.value = amp * 0.6 * Math.sin(u * 47 + 1.3)
  }

  function updateSparks(dt: number) {
    if (!sparkCtx) return
    sparkCtx.clearRect(0, 0, stageW, stageH)
    if (sparks.length === 0) return
    const next: Spark[] = []
    for (const s of sparks) {
      s.age += dt * 1000
      if (s.age >= s.ttl) continue
      s.vy += SPARK_GRAVITY * dt
      s.x += s.vx * dt
      s.y += s.vy * dt
      next.push(s)
      const life = 1 - s.age / s.ttl
      sparkCtx.globalAlpha = life
      sparkCtx.strokeStyle = sparkColor
      sparkCtx.lineWidth = s.size
      sparkCtx.beginPath()
      sparkCtx.moveTo(s.x, s.y)
      sparkCtx.lineTo(s.x - s.vx * 0.02, s.y - s.vy * 0.02)
      sparkCtx.stroke()
      sparkCtx.globalAlpha = life * 0.5
      sparkCtx.strokeStyle = '#ffffff'
      sparkCtx.lineWidth = Math.max(0.5, s.size - 1)
      sparkCtx.stroke()
    }
    sparkCtx.globalAlpha = 1
    sparks = next
  }

  function frame(now: number) {
    const t = now - startAt
    const dt = Math.min(0.05, (now - lastFrameAt) / 1000)
    lastFrameAt = now
    const marks = anchors()

    if (phase.value === 'spinning') {
      carouselOffset.value = sampleOffset(t, marks.spin)
      detectTicks(t, marks.spin)
      if (t >= marks.land) {
        carouselOffset.value = targetOffset
        phase.value = 'landed'
        opts.onLand?.()
      }
    }
    if (phase.value === 'landed' && t >= marks.swing) {
      phase.value = 'slicing'
      halfLeft.value = { x: 0, y: 0, angle: 0, opacity: 1 }
      halfRight.value = { x: 0, y: 0, angle: 0, opacity: 1 }
      opts.onSwing?.()
    }
    if (phase.value === 'slicing') {
      if (!cutReleased && t >= marks.cut) {
        cutReleased = true
        releaseHalves()
      }
      if (t >= marks.reveal) {
        phase.value = 'revealing'
        opts.onReveal?.()
        const rarity = opts.result.value?.rarity
        if (!revealBurstFired && rarity && RARITY_ORDER.indexOf(rarity) >= 4) {
          revealBurstFired = true
          spawnRevealBurst()
        }
      }
    }
    if (phase.value === 'revealing' && t >= marks.done) {
      phase.value = 'revealed'
      scoreVisible.value = false
      opts.onComplete?.()
    }

    if (halvesActive.value) updateHalves(dt, t, marks.cut)
    if (cutReleased) updateShake(t, marks.cut)
    updateSparks(dt)

    const finished =
      phase.value === 'revealed' && !halvesActive.value && sparks.length === 0
    if (finished) {
      rafId = 0
      return
    }
    rafId = requestAnimationFrame(frame)
  }

  async function play() {
    stopLoop()
    resetEffects()
    const seq = ++playSeq

    const result = opts.result.value
    if (!result) {
      phase.value = 'idle'
      armed.value = false
      carousel.value = []
      return
    }

    const winner: CrateRoll = {
      item: result,
      modifiers: opts.resultModifiers.value,
      unusualEffect: opts.resultUnusualEffect.value,
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      carousel.value = []
      armed.value = true
      phase.value = 'revealed'
      opts.onComplete?.()
      return
    }

    phase.value = 'idle'
    armed.value = false
    carousel.value = []
    carouselOffset.value = 0
    await nextTick()
    if (seq !== playSeq) return

    carousel.value = buildCarousel(winner)
    armed.value = true
    phase.value = 'ready'
    await nextTick()
    if (seq !== playSeq) return

    measureStage()
    rollGeometry()
    sparkColor = rarityCssColor(result.rarity)
    lastTickIndex = reticleIndex(0)

    const urls = Array.from(
      new Set(carousel.value.map((c) => c.item.iconUrl).filter((u): u is string => !!u)),
    )
    await Promise.race([decodeImages(urls), delay(MAX_PRELOAD_MS)])
    if (seq !== playSeq) return
    await raf()
    await raf()
    if (seq !== playSeq) return

    startAt = performance.now()
    lastFrameAt = startAt
    phase.value = 'spinning'
    rafId = requestAnimationFrame(frame)
  }

  function skip() {
    if (phase.value === 'idle' || phase.value === 'revealed') return
    playSeq++
    stopLoop()
    resetEffects()
    phase.value = 'revealed'
    opts.onSkip?.()
    opts.onComplete?.()
  }

  onUnmounted(() => {
    playSeq++
    stopLoop()
  })

  return {
    phase,
    carousel,
    landingIndex,
    carouselOffset,
    armed,
    cutPct,
    cutShiftPct,
    bladeTiltDeg,
    hitScore,
    halvesActive,
    halfLeft,
    halfRight,
    shakeX,
    shakeY,
    scoreVisible,
    play,
    skip,
  }
}
