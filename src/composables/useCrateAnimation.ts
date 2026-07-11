import type { ItemModifierRef, ItemResponse, UnusualEffectRef } from '@/types/api/items'
import { nextTick, onUnmounted, ref, type Ref } from 'vue'

export type CratePhase =
  | 'idle'
  | 'spinning'
  | 'landed'
  | 'slicing'
  | 'falling'
  | 'revealing'
  | 'revealed'

export interface CrateAnimationPoolEntry {
  item: ItemResponse
  weight: number
  modifiers?: ItemModifierRef[]
  unusualEffect?: UnusualEffectRef | null
}

export interface CrateCarouselSlot {
  item: ItemResponse
  modifiers: ItemModifierRef[]
  unusualEffect: UnusualEffectRef | null
}

interface UseCrateAnimationOptions {
  result: Ref<ItemResponse | null>
  resultModifiers: Ref<ItemModifierRef[]>
  resultUnusualEffect: Ref<UnusualEffectRef | null>
  pool: Ref<CrateAnimationPoolEntry[]>
  cardWidth: Ref<number>
  cardGap: Ref<number>
  carouselLength: Ref<number>
  spinDurationMs: Ref<number>
  stageEl: Ref<HTMLElement | null>
  onComplete?: () => void
  onSkip?: () => void
}

const PHASE_TIMING = {
  landedHold: 320,
  slice: 180,
  fall: 520,
  reveal: 420,
} as const

export const CRATE_PHASE_DURATIONS = PHASE_TIMING

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function pickWeightedEntry(pool: CrateAnimationPoolEntry[]): CrateAnimationPoolEntry | null {
  const total = pool.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0)
  if (total <= 0) return null
  let pick = Math.random() * total
  for (const entry of pool) {
    const w = Math.max(0, entry.weight)
    if (pick < w) return entry
    pick -= w
  }
  return pool[pool.length - 1]
}

function waitFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

function toSlot(entry: CrateAnimationPoolEntry | null, fallback: CrateCarouselSlot): CrateCarouselSlot {
  if (!entry) return fallback
  return { item: entry.item, modifiers: entry.modifiers ?? [], unusualEffect: entry.unusualEffect ?? null }
}

export function useCrateAnimation(opts: UseCrateAnimationOptions) {
  const phase = ref<CratePhase>('idle')
  const carousel = ref<CrateCarouselSlot[]>([])
  const landingIndex = ref(0)
  const carouselOffset = ref(0)
  const isSpinning = ref(false)
  const armed = ref(false)
  const cutPct = ref(0.5)
  const hitScore = ref(115)

  const reduceMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

  let timers: number[] = []

  function clearTimers() {
    for (const t of timers) clearTimeout(t)
    timers = []
  }

  function scheduleAt(fn: () => void, ms: number) {
    timers.push(window.setTimeout(fn, ms))
  }

  function buildCarousel(winner: CrateCarouselSlot, pool: CrateAnimationPoolEntry[]) {
    const len = opts.carouselLength.value
    const items: CrateCarouselSlot[] = []
    if (pool.length === 0) {
      for (let i = 0; i < len; i++) items.push(winner)
    } else {
      for (let i = 0; i < len; i++) {
        items.push(toSlot(pickWeightedEntry(pool), winner))
      }
    }
    const landing = Math.max(0, len - 6)
    items[landing] = winner
    return { items, landing }
  }

  function computeJitter(cardW: number) {
    const innerMargin = Math.min(18, cardW * 0.15)
    const maxJitter = cardW / 2 - innerMargin
    const jitter = (Math.random() * 2 - 1) * maxJitter
    return { jitter, maxJitter }
  }

  async function play() {
    clearTimers()

    const result = opts.result.value
    if (!result) {
      phase.value = 'idle'
      armed.value = false
      return
    }

    const winner: CrateCarouselSlot = {
      item: result,
      modifiers: opts.resultModifiers.value,
      unusualEffect: opts.resultUnusualEffect.value,
    }

    if (reduceMotion) {
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
    isSpinning.value = false
    await nextTick()

    const { items, landing } = buildCarousel(winner, opts.pool.value)
    carousel.value = items
    landingIndex.value = landing
    armed.value = true

    await nextTick()
    await waitFrame()
    await waitFrame()

    const cardW = opts.cardWidth.value
    const stageWidth = opts.stageEl.value?.clientWidth ?? 640
    const cardTotal = cardW + opts.cardGap.value
    const centerOffset = -(landing * cardTotal) + stageWidth / 2 - cardW / 2

    const { jitter, maxJitter } = computeJitter(cardW)
    cutPct.value = clamp(0.5 - jitter / cardW, 0, 1)
    const normalizedMiss = maxJitter > 0 ? Math.min(1, Math.abs(jitter) / maxJitter) : 0
    hitScore.value = Math.round(100 + 15 * (1 - normalizedMiss))

    isSpinning.value = true
    carouselOffset.value = centerOffset + jitter
    phase.value = 'spinning'

    const spin = opts.spinDurationMs.value
    const t1 = spin
    const t2 = t1 + PHASE_TIMING.landedHold
    const t3 = t2 + PHASE_TIMING.slice
    const t4 = t3 + PHASE_TIMING.fall
    const t5 = t4 + PHASE_TIMING.reveal

    scheduleAt(() => { phase.value = 'landed' }, t1)
    scheduleAt(() => { phase.value = 'slicing' }, t2)
    scheduleAt(() => { phase.value = 'falling' }, t3)
    scheduleAt(() => { phase.value = 'revealing' }, t4)
    scheduleAt(() => {
      phase.value = 'revealed'
      opts.onComplete?.()
    }, t5)
  }

  function skip() {
    if (phase.value === 'idle' || phase.value === 'revealed') return
    clearTimers()
    phase.value = 'revealed'
    opts.onSkip?.()
    opts.onComplete?.()
  }

  onUnmounted(clearTimers)

  return {
    phase,
    carousel,
    landingIndex,
    carouselOffset,
    isSpinning,
    armed,
    cutPct,
    hitScore,
    play,
    skip,
  }
}
