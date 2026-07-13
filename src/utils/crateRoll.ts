import type {
  CrateContentResponse,
  CrateModifierResponse,
  ItemModifierRef,
  ItemModifierResponse,
  ItemResponse,
  UnusualEffectRef,
} from '@/types/api/items'
import { sortModifiersByKey } from './items'
import { isModifierInSeason } from './modifiers'

export interface CrateRollContext {
  contents: CrateContentResponse[]
  crateModifiers: CrateModifierResponse[]
  globalModifiers: ItemModifierResponse[]
  unusualEffects: UnusualEffectRef[]
}

export interface CrateRoll {
  item: ItemResponse
  modifiers: ItemModifierRef[]
  unusualEffect: UnusualEffectRef | null
}

function toModifierRef(m: ItemModifierResponse): ItemModifierRef {
  return { id: m.id, key: m.key, name: m.name, colorHex: m.colorHex, effectSpec: m.effectSpec }
}

export function globalRollCandidates(
  globalModifiers: ItemModifierResponse[],
  crateModifiers: CrateModifierResponse[],
): ItemModifierResponse[] {
  const attached = new Set(crateModifiers.map((cm) => cm.modifier.id))
  return globalModifiers.filter(
    (m) =>
      m.active && m.globalDropChance != null && !attached.has(m.id) && isModifierInSeason(m),
  )
}

function pickWeightedContent(contents: CrateContentResponse[]): CrateContentResponse | null {
  const total = contents.reduce((sum, c) => sum + Math.max(0, c.dropWeight), 0)
  if (total <= 0) return null
  let pick = Math.random() * total
  for (const c of contents) {
    const w = Math.max(0, c.dropWeight)
    if (pick < w) return c
    pick -= w
  }
  return contents[contents.length - 1]
}

function rollModifierSet(
  crateModifiers: CrateModifierResponse[],
  globalCandidates: ItemModifierResponse[],
): ItemModifierRef[] {
  const winners: ItemModifierRef[] = []
  for (const cm of crateModifiers) {
    if (Math.random() < cm.dropChance) winners.push(cm.modifier)
  }
  for (const m of globalCandidates) {
    if (Math.random() < (m.globalDropChance ?? 0)) winners.push(toModifierRef(m))
  }
  return sortModifiersByKey(winners)
}

function rollUnusualEffect(
  modifiers: ItemModifierRef[],
  effects: UnusualEffectRef[],
): UnusualEffectRef | null {
  if (effects.length === 0) return null
  if (!modifiers.some((m) => m.key === 'unusual')) return null
  return effects[Math.floor(Math.random() * effects.length)]
}

export function createCrateRoller(
  ctx: CrateRollContext,
): (excludeItemIds?: ReadonlySet<string>) => CrateRoll | null {
  const candidates = globalRollCandidates(ctx.globalModifiers, ctx.crateModifiers)
  return (excludeItemIds) => {
    const pool = excludeItemIds?.size
      ? ctx.contents.filter((c) => !excludeItemIds.has(c.rewardItem.id))
      : ctx.contents
    const content = pickWeightedContent(pool) ?? pickWeightedContent(ctx.contents)
    if (!content) return null
    const modifiers = rollModifierSet(ctx.crateModifiers, candidates)
    return {
      item: content.rewardItem,
      modifiers,
      unusualEffect: rollUnusualEffect(modifiers, ctx.unusualEffects),
    }
  }
}
