import type {
  AssetSet,
  BadgeValue,
  BorderColorFill,
  BorderColorStateValue,
  BorderColorValue,
  BorderShapeStateValue,
  BorderShapeValue,
  Composition,
  CrateContentResponse,
  Gradient,
  GradientStop,
  ItemModifierRef,
  ItemRarity,
  ItemResponse,
  ItemTypeKey,
  ItemVariant,
  Loop,
  ModifierEffectSpec,
  PerkValue,
  ProfileBackgroundValue,
  ProfileThumbnailBackgroundValue,
  StatisticValue,
  ThemeValue,
  TitleStateValue,
  TitleValue,
  UnusualEffectRef,
  UserItemResponse,
} from '@/types/api/items'

const EQUIPPABLE_TYPE_KEYS = new Set<ItemTypeKey>([
  'badge',
  'title',
  'profile_border',
  'profile_border_shape',
  'profile_border_color',
  'theme',
  'profile_visual',
  'profile_background',
  'profile_thumbnail_background',
])

export function isEquippableTypeKey(typeKey: ItemTypeKey): boolean {
  return EQUIPPABLE_TYPE_KEYS.has(typeKey)
}

export const RARITY_ORDER: ItemRarity[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
  'mythic',
]

export function rarityClass(rarity: ItemRarity): string {
  return `rarity--${rarity}`
}

export interface CrateRarityGroup {
  rarity: ItemRarity
  items: CrateContentResponse[]
  chance: number
}

export function groupCrateContentsByRarity(contents: CrateContentResponse[]): CrateRarityGroup[] {
  const totalWeight = contents.reduce((sum, c) => sum + c.dropWeight, 0)
  const byRarity = new Map<ItemRarity, CrateContentResponse[]>()
  for (const c of contents) {
    const list = byRarity.get(c.rewardItem.rarity)
    if (list) list.push(c)
    else byRarity.set(c.rewardItem.rarity, [c])
  }
  return [...RARITY_ORDER]
    .reverse()
    .filter((r) => byRarity.has(r))
    .map((rarity) => {
      const items = byRarity.get(rarity) as CrateContentResponse[]
      const weight = items.reduce((sum, c) => sum + c.dropWeight, 0)
      return { rarity, items, chance: totalWeight > 0 ? weight / totalWeight : 0 }
    })
}

const SUBTLE_MODIFIER_KEYS = new Set<string>(['normal', 'unique', 'standard'])

function isSubtleModifierKey(key: string | null | undefined): boolean {
  if (!key) return true
  return SUBTLE_MODIFIER_KEYS.has(key)
}

export function modifierAccentHex(
  modifier: { key: string; colorHex?: string | null } | null | undefined,
  fallbackHex?: string | null,
): string | null {
  if (!modifier) return null
  return modifier.colorHex ?? fallbackHex ?? null
}

export function sortModifiersByKey<T extends { key: string }>(modifiers: T[]): T[] {
  return [...modifiers].sort((a, b) => a.key.localeCompare(b.key))
}

export function visibleModifiers<T extends { key: string }>(modifiers: T[]): T[] {
  return modifiers.filter((m) => !isSubtleModifierKey(m.key))
}

export function primaryModifier<T extends { key: string }>(modifiers: T[]): T | null {
  const visible = visibleModifiers(modifiers)
  if (visible.length > 0) return sortModifiersByKey(visible)[0]
  return modifiers[0] ?? null
}

export interface EffectLayer {
  key: string
  spec: ModifierEffectSpec
}

export function buildEffectLayers(
  modifiers: ItemModifierRef[] | null | undefined,
  unusualEffect?: UnusualEffectRef | null,
): EffectLayer[] {
  const layers: EffectLayer[] = []
  for (const m of sortModifiersByKey(modifiers ?? [])) {
    if (m.effectSpec) layers.push({ key: `m:${m.id}`, spec: m.effectSpec })
  }
  if (unusualEffect?.effectSpec) {
    layers.push({ key: `u:${unusualEffect.id}`, spec: unusualEffect.effectSpec })
  }
  return layers
}

export function unusualEffectLayers(unusualEffect?: UnusualEffectRef | null): EffectLayer[] {
  return buildEffectLayers(null, unusualEffect)
}

export interface StackedEffectLayer extends EffectLayer {
  stackIndex: number
}

export function annotateEffectLayerStacks(
  layers: EffectLayer[] | null | undefined,
): StackedEffectLayer[] {
  const seen = new Map<string, number>()
  return (layers ?? []).map((layer) => {
    const n = seen.get(layer.key) ?? 0
    seen.set(layer.key, n + 1)
    return { key: n > 0 ? `${layer.key}#${n}` : layer.key, spec: layer.spec, stackIndex: n }
  })
}

export interface FragmentSpec {
  radiusPct: number
  cols: number
  black: string
  red: string
}

function parseFragment(c: Composition): FragmentSpec {
  const num = (v: unknown, d: number) => (typeof v === 'number' ? v : d)
  const stx = (v: unknown, d: string) => (typeof v === 'string' ? v : d)
  return {
    radiusPct: Math.max(20, Math.min(100, num(c.radiusPct, 40))),
    cols: Math.max(3, Math.min(9, Math.round(num(c.cols, 6)))),
    black: stx(c.black, '#0c0a0a'),
    red: stx(c.red, '#d8241c'),
  }
}

export function readFragmentSpec(unusualEffect?: UnusualEffectRef | null): FragmentSpec | null {
  const c = unusualEffect?.effectSpec?.compositions?.find((comp) => comp.type === 'fragment')
  return c ? parseFragment(c) : null
}

export function readFragmentFromLayers(
  layers: EffectLayer[] | null | undefined,
): { spec: FragmentSpec; count: number; seed: string } | null {
  if (!layers) return null
  let spec: FragmentSpec | null = null
  let seed = ''
  let count = 0
  for (const layer of layers) {
    const c = layer.spec.compositions.find((comp) => comp.type === 'fragment')
    if (c) {
      count++
      if (!spec) {
        spec = parseFragment(c)
        seed = layer.key
      }
    }
  }
  return spec ? { spec, count, seed } : null
}

export function displayItemName(
  modifiers: ReadonlyArray<{ key: string; name: string }> | null | undefined,
  itemName: string,
): string {
  if (!modifiers || modifiers.length === 0) return itemName
  const named = sortModifiersByKey(modifiers.filter((m) => m.key !== 'normal'))
  if (named.length === 0) return itemName
  return `${named.map((m) => m.name).join(' ')} ${itemName}`
}

function isObj(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isString(v: unknown): v is string {
  return typeof v === 'string'
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function isGradient(v: unknown): v is Gradient {
  if (!isObj(v)) return false
  if (v.type !== 'linear' && v.type !== 'radial' && v.type !== 'conic') return false
  if (!Array.isArray(v.stops)) return false
  return v.stops.every(
    (s) => isObj(s) && isNumber(s.atPct) && isString(s.hex),
  )
}

export function readTitleValue(value: unknown): TitleValue | null {
  if (!isObj(value)) return null
  if (!isString(value.text)) return null
  if (!Array.isArray(value.states) || value.states.length === 0) return null
  const states = value.states.filter((s): s is Record<string, unknown> => isObj(s) && isNumber(s.atMs))
  if (states.length === 0) return null
  return value as unknown as TitleValue
}

export function readBorderShapeValue(value: unknown): BorderShapeValue | null {
  if (!isObj(value)) return null
  if (!Array.isArray(value.states) || value.states.length === 0) return null
  const renderMode = value.renderMode
  if (renderMode === 'pixel') {
    const validStates = value.states.filter((s) => isObj(s) && isNumber(s.atMs))
    if (validStates.length === 0) return null
    return value as unknown as BorderShapeValue
  }
  const validStates = value.states.filter(
    (s) => isObj(s) && isNumber(s.atMs) && Array.isArray(s.paths)
      && (s.paths as unknown[]).every((p) => isObj(p) && isString(p.d)),
  )
  if (validStates.length === 0) return null
  return value as unknown as BorderShapeValue
}

function isPixelMetalFill(v: unknown): boolean {
  if (!isObj(v)) return false
  if (v.type !== 'pixel_metal') return false
  return isString(v.base) && isString(v.highlight) && isString(v.shadow)
}

function isCosmicFill(v: unknown): boolean {
  if (!isObj(v)) return false
  if (v.type !== 'cosmic') return false
  return isString(v.space) && isString(v.star) && isString(v.accent)
    && Array.isArray(v.nebulas) && v.nebulas.every(isString)
}

function isToonFill(v: unknown): boolean {
  if (!isObj(v)) return false
  if (v.type !== 'toon') return false
  return isString(v.ink) && isString(v.line)
}

export function readBorderColorValue(value: unknown): BorderColorValue | null {
  if (!isObj(value)) return null
  if (!Array.isArray(value.states) || value.states.length === 0) return null
  const validStates = value.states.filter((s) => {
    if (!isObj(s) || !isNumber(s.atMs)) return false
    const fill = s.fill
    if (!isObj(fill)) return false
    if (fill.type === 'solid') return isString(fill.hex)
    if (fill.type === 'pixel_metal') return isPixelMetalFill(fill)
    if (fill.type === 'cosmic') return isCosmicFill(fill)
    if (fill.type === 'toon') return isToonFill(fill)
    return isGradient(fill)
  })
  if (validStates.length === 0) return null
  return value as unknown as BorderColorValue
}

export function readBadgeValue(value: unknown): BadgeValue | null {
  if (!isObj(value)) return null
  const asset = value.asset
  if (!isObj(asset) || !isString(asset.altText)) return null
  return value as unknown as BadgeValue
}

export function readBackgroundValue(value: unknown): ProfileBackgroundValue | null {
  if (!isObj(value)) return null
  if (!isObj(value.asset)) return null
  return value as unknown as ProfileBackgroundValue
}

export function readThumbnailBackgroundValue(value: unknown): ProfileThumbnailBackgroundValue | null {
  if (!isObj(value)) return null
  if (!isObj(value.asset)) return null
  return value as unknown as ProfileThumbnailBackgroundValue
}

export function readThemeValue(value: unknown): ThemeValue | null {
  if (!isObj(value) || !isObj(value.tokens)) return null
  return value as unknown as ThemeValue
}

export function readItemVariants(value: unknown): ItemVariant[] | null {
  if (!isObj(value) || !Array.isArray(value.variants)) return null
  const variants = value.variants.filter(
    (v): v is ItemVariant => isObj(v) && isString(v.key) && isString(v.label),
  )
  return variants.length > 0 ? variants : null
}

export function resolveItemVariant<T extends { variants?: ItemVariant[] }>(
  value: T,
  variantKey: string | null | undefined,
): T {
  if (!variantKey || !value.variants) return value
  const variant = value.variants.find((v) => v.key === variantKey)
  if (!variant) return value
  const overrides = Object.fromEntries(
    Object.entries(variant).filter(([k]) => k !== 'key' && k !== 'label'),
  )
  return { ...value, ...overrides }
}

export function resolveEquippedVariant<T extends { variants?: ItemVariant[] }>(
  slot: UserItemResponse | null | undefined,
  read: (value: unknown) => T | null,
): T | null {
  if (!slot) return null
  const value = read(slot.item.value)
  return value ? resolveItemVariant(value, slot.variantKey) : null
}

export interface ItemVariantPreview {
  key: string
  label: string
  item: ItemResponse
}

function themeModeLabel(tokens: Record<string, string>): string {
  return tokens.base === 'light' ? 'Light' : 'Dark'
}

export function itemVariantPreviews(item: ItemResponse): ItemVariantPreview[] | null {
  const variants = readItemVariants(item.value)
  if (variants && variants.length > 1) {
    return variants.map((v) => ({
      key: v.key,
      label: v.label,
      item: {
        ...item,
        value: resolveItemVariant(
          item.value as { variants?: ItemVariant[] },
          v.key,
        ) as ItemResponse['value'],
      },
    }))
  }
  if (item.typeKey === 'theme') {
    const theme = readThemeValue(item.value)
    if (theme?.altTokens) {
      return [
        { key: 'default', label: themeModeLabel(theme.tokens), item },
        {
          key: 'alt',
          label: themeModeLabel(theme.altTokens),
          item: {
            ...item,
            value: { ...theme, tokens: theme.altTokens } as unknown as ItemResponse['value'],
          },
        },
      ]
    }
  }
  return null
}

export function readStatisticValue(value: unknown): StatisticValue | null {
  if (!isObj(value) || !isString(value.statKey) || !isString(value.label)) return null
  return value as unknown as StatisticValue
}

export function readPerkValue(value: unknown): PerkValue | null {
  if (!isObj(value) || !isString(value.effect)) return null
  return value as unknown as PerkValue
}

const RASTER_PRIORITY = ['4x', '3x', '2x', '1x'] as const

export function pickAssetUrl(asset: AssetSet | null | undefined): string | null {
  if (!asset) return null
  if (asset.svg) return asset.svg
  if (asset.raster) {
    for (const k of RASTER_PRIORITY) {
      const url = asset.raster[k]
      if (url) return url
    }
    for (const url of Object.values(asset.raster)) {
      if (isString(url)) return url
    }
  }
  return null
}

export function pickVideoOrAssetUrl(asset: AssetSet | null | undefined): string | null {
  if (!asset) return null
  if (asset.video) return asset.video
  return pickAssetUrl(asset)
}

export interface TimelineOptions {
  states: Array<{ atMs: number }>
  durationMs?: number
  loop?: Loop
}

export function pickStateAt<S extends { atMs: number }>(
  options: { states: S[]; durationMs?: number; loop?: Loop },
  tNow: number,
): S {
  const { states } = options
  if (states.length === 1) return states[0]

  const sorted = [...states].sort((a, b) => a.atMs - b.atMs)
  const lastAt = sorted[sorted.length - 1].atMs
  const total = options.durationMs ?? lastAt
  if (total <= 0) return sorted[0]

  const loop: Loop = options.loop ?? 'loop'
  let t: number
  if (loop === 'once') {
    t = Math.min(Math.max(tNow, 0), total)
  } else if (loop === 'pingpong') {
    const cycles = Math.floor(tNow / total)
    const inCycle = tNow - cycles * total
    t = cycles % 2 === 0 ? inCycle : total - inCycle
  } else {
    t = ((tNow % total) + total) % total
  }

  let current = sorted[0]
  for (const s of sorted) {
    if (s.atMs <= t) current = s
    else break
  }
  return current
}

export interface TokenContext {
  serial?: number | null
  wearLevel?: number | null
  stats?: Record<string, number | string | null | undefined>
}

const TOKEN_RE = /\$\{([a-zA-Z_][\w.:]*)\}/g

export function substituteTokens(text: string, ctx: TokenContext): string | null {
  let missing = false
  const out = text.replace(TOKEN_RE, (_match, token: string) => {
    let resolved: unknown
    if (token === 'serial') resolved = ctx.serial
    else if (token === 'wearLevel') resolved = ctx.wearLevel
    else if (token.startsWith('stat:') && ctx.stats) resolved = ctx.stats[token.slice(5)]
    if (resolved === undefined || resolved === null) {
      missing = true
      return ''
    }
    return String(resolved)
  })
  return missing ? null : out
}

export function userItemTokenContext(userItem: Pick<UserItemResponse, 'serialNumber'>): TokenContext {
  return { serial: userItem.serialNumber }
}

export function gradientToCss(g: Gradient): string {
  const stops = g.stops
    .slice()
    .sort((a, b) => a.atPct - b.atPct)
    .map((s) => `${s.hex} ${s.atPct}%`)
    .join(', ')
  if (g.type === 'linear') return `linear-gradient(${g.angleDeg}deg, ${stops})`
  if (g.type === 'radial') {
    const cx = g.centerXPct ?? 50
    const cy = g.centerYPct ?? 50
    return `radial-gradient(circle at ${cx}% ${cy}%, ${stops})`
  }
  const cx = g.centerXPct ?? 50
  const cy = g.centerYPct ?? 50
  const angle = g.angleDeg ?? 0
  return `conic-gradient(from ${angle}deg at ${cx}% ${cy}%, ${stops})`
}

export function fillToCss(fill: BorderColorFill): string {
  if (fill.type === 'solid') return fill.hex
  if (fill.type === 'pixel_metal') {
    return `linear-gradient(135deg, ${fill.highlight} 0%, ${fill.base} 50%, ${fill.shadow} 100%)`
  }
  if (fill.type === 'cosmic') {
    const nebula = fill.nebulas[0] ?? fill.accent
    return `radial-gradient(circle at 30% 30%, ${nebula} 0%, ${fill.space} 60%)`
  }
  if (fill.type === 'toon') {
    return `repeating-linear-gradient(135deg, ${fill.ink} 0px, ${fill.ink} 7px, ${fill.line} 7px, ${fill.line} 9px)`
  }
  return gradientToCss(fill)
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

export function lerpNumber(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function parseHex(hex: string): { r: number; g: number; b: number; a: number } | null {
  const m = hex.match(/^#([0-9a-fA-F]{3,8})$/)
  if (!m) return null
  let s = m[1]
  if (s.length === 3 || s.length === 4) {
    s = s.split('').map((c) => c + c).join('')
  }
  if (s.length !== 6 && s.length !== 8) return null
  const r = parseInt(s.slice(0, 2), 16)
  const g = parseInt(s.slice(2, 4), 16)
  const b = parseInt(s.slice(4, 6), 16)
  const a = s.length === 8 ? parseInt(s.slice(6, 8), 16) / 255 : 1
  return { r, g, b, a }
}

function toHexByte(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
}

export function lerpColor(hexA: string, hexB: string, t: number): string {
  const a = parseHex(hexA)
  const b = parseHex(hexB)
  if (!a || !b) return t < 0.5 ? hexA : hexB
  const r = lerpNumber(a.r, b.r, t)
  const g = lerpNumber(a.g, b.g, t)
  const bl = lerpNumber(a.b, b.b, t)
  const al = lerpNumber(a.a, b.a, t)
  if (al < 1) {
    return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(bl)},${al.toFixed(3)})`
  }
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(bl)}`
}

function lerpStops(a: GradientStop[], b: GradientStop[], t: number): GradientStop[] {
  if (a.length !== b.length) return t < 0.5 ? a : b
  return a.map((sa, i) => ({
    atPct: lerpNumber(sa.atPct, b[i].atPct, t),
    hex: lerpColor(sa.hex, b[i].hex, t),
  }))
}

export function interpolateGradient(a: Gradient, b: Gradient, t: number): Gradient {
  if (a.type !== b.type) return t < 0.5 ? a : b
  if (a.type === 'linear' && b.type === 'linear') {
    return {
      type: 'linear',
      angleDeg: lerpNumber(a.angleDeg, b.angleDeg, t),
      stops: lerpStops(a.stops, b.stops, t),
    }
  }
  if (a.type === 'radial' && b.type === 'radial') {
    return {
      type: 'radial',
      centerXPct: lerpNumber(a.centerXPct ?? 50, b.centerXPct ?? 50, t),
      centerYPct: lerpNumber(a.centerYPct ?? 50, b.centerYPct ?? 50, t),
      radiusPct: lerpNumber(a.radiusPct ?? 50, b.radiusPct ?? 50, t),
      stops: lerpStops(a.stops, b.stops, t),
    }
  }
  if (a.type === 'conic' && b.type === 'conic') {
    return {
      type: 'conic',
      centerXPct: lerpNumber(a.centerXPct ?? 50, b.centerXPct ?? 50, t),
      centerYPct: lerpNumber(a.centerYPct ?? 50, b.centerYPct ?? 50, t),
      angleDeg: lerpNumber(a.angleDeg ?? 0, b.angleDeg ?? 0, t),
      stops: lerpStops(a.stops, b.stops, t),
    }
  }
  return t < 0.5 ? a : b
}

export function interpolateFill(a: BorderColorFill, b: BorderColorFill, t: number): BorderColorFill {
  if (a.type === 'cosmic' || b.type === 'cosmic' || a.type === 'toon' || b.type === 'toon') {
    return t < 0.5 ? a : b
  }
  if (a.type === 'solid' && b.type === 'solid') {
    return { type: 'solid', hex: lerpColor(a.hex, b.hex, t) }
  }
  if (a.type === 'pixel_metal' && b.type === 'pixel_metal') {
    return {
      type: 'pixel_metal',
      base: lerpColor(a.base, b.base, t),
      highlight: lerpColor(a.highlight, b.highlight, t),
      shadow: lerpColor(a.shadow, b.shadow, t),
    }
  }
  if (a.type !== 'solid' && a.type !== 'pixel_metal' && b.type !== 'solid' && b.type !== 'pixel_metal') {
    return interpolateGradient(a, b, t)
  }
  return t < 0.5 ? a : b
}

export function interpolateBorderColorState(
  a: BorderColorStateValue,
  b: BorderColorStateValue,
  t: number,
): BorderColorStateValue {
  return {
    atMs: lerpNumber(a.atMs, b.atMs, t),
    fill: interpolateFill(a.fill, b.fill, t),
    filters: t < 0.5 ? a.filters : b.filters,
  }
}

export function interpolateTitleState(
  a: TitleStateValue,
  b: TitleStateValue,
  t: number,
): TitleStateValue {
  const out: TitleStateValue = { atMs: lerpNumber(a.atMs, b.atMs, t) }
  if (a.color && b.color) out.color = lerpColor(a.color, b.color, t)
  else out.color = t < 0.5 ? a.color : b.color
  if (a.gradient && b.gradient) out.gradient = interpolateGradient(a.gradient, b.gradient, t)
  else out.gradient = t < 0.5 ? a.gradient : b.gradient
  if (a.letterSpacingPx != null && b.letterSpacingPx != null) {
    out.letterSpacingPx = lerpNumber(a.letterSpacingPx, b.letterSpacingPx, t)
  } else {
    out.letterSpacingPx = t < 0.5 ? a.letterSpacingPx : b.letterSpacingPx
  }
  out.fontWeight = t < 0.5 ? a.fontWeight : b.fontWeight
  out.fontStyle = t < 0.5 ? a.fontStyle : b.fontStyle
  out.effects = t < 0.5 ? a.effects : b.effects
  return out
}

export function pickInterpolatedState<S extends { atMs: number }>(
  options: { states: S[]; durationMs?: number; loop?: Loop },
  tNow: number,
  interp: (a: S, b: S, t: number) => S,
): S {
  const { states } = options
  if (states.length === 1) return states[0]

  const sorted = [...states].sort((a, b) => a.atMs - b.atMs)
  const lastAt = sorted[sorted.length - 1].atMs
  const total = options.durationMs ?? lastAt
  if (total <= 0) return sorted[0]

  const loop: Loop = options.loop ?? 'loop'
  let t: number
  if (loop === 'once') {
    t = Math.min(Math.max(tNow, 0), total)
  } else if (loop === 'pingpong') {
    const cycles = Math.floor(tNow / total)
    const inCycle = tNow - cycles * total
    t = cycles % 2 === 0 ? inCycle : total - inCycle
  } else {
    t = ((tNow % total) + total) % total
  }

  let prev = sorted[0]
  let next = sorted[sorted.length - 1]
  for (let i = 0; i < sorted.length - 1; i++) {
    if (t >= sorted[i].atMs && t <= sorted[i + 1].atMs) {
      prev = sorted[i]
      next = sorted[i + 1]
      break
    }
  }
  if (prev === next) return prev
  const range = next.atMs - prev.atMs
  if (range <= 0) return prev
  const localT = (t - prev.atMs) / range
  return interp(prev, next, easeInOut(localT))
}

export function isAnimated(value: { states: Array<unknown>; durationMs?: number } | null | undefined): boolean {
  if (!value) return false
  return value.states.length > 1
}

export function samplePath(pathEl: SVGPathElement, samples: number): [number, number][] {
  const result: [number, number][] = []
  const totalLen = pathEl.getTotalLength()
  if (totalLen === 0 || samples === 0) return result
  for (let i = 0; i < samples; i++) {
    const dist = (i / samples) * totalLen
    const p = pathEl.getPointAtLength(dist)
    result.push([p.x, p.y])
  }
  return result
}

function alignmentCost(
  a: [number, number][],
  b: [number, number][],
  offset: number,
  reverse: boolean,
): number {
  const N = a.length
  let cost = 0
  for (let i = 0; i < N; i++) {
    const j = reverse ? (N - 1 - ((i + offset) % N) + N) % N : (i + offset) % N
    const dx = a[i][0] - b[j][0]
    const dy = a[i][1] - b[j][1]
    cost += dx * dx + dy * dy
  }
  return cost
}

function rotateOrReverse(
  arr: [number, number][],
  offset: number,
  reverse: boolean,
): [number, number][] {
  const N = arr.length
  const out: [number, number][] = new Array(N)
  for (let i = 0; i < N; i++) {
    const j = reverse ? (N - 1 - ((i + offset) % N) + N) % N : (i + offset) % N
    out[i] = arr[j]
  }
  return out
}

export function alignSamples(
  reference: [number, number][],
  target: [number, number][],
): [number, number][] {
  const N = reference.length
  if (N === 0 || target.length !== N) return target
  let bestOffset = 0
  let bestReverse = false
  let bestCost = alignmentCost(reference, target, 0, false)
  for (let r = 1; r < N; r++) {
    const cost = alignmentCost(reference, target, r, false)
    if (cost < bestCost) {
      bestCost = cost
      bestOffset = r
      bestReverse = false
    }
  }
  for (let r = 0; r < N; r++) {
    const cost = alignmentCost(reference, target, r, true)
    if (cost < bestCost) {
      bestCost = cost
      bestOffset = r
      bestReverse = true
    }
  }
  return rotateOrReverse(target, bestOffset, bestReverse)
}

export function sampleShapeStates(
  states: BorderShapeStateValue[],
  samples: number,
): Array<Array<[number, number][]>> {
  if (typeof document === 'undefined') return []
  const SVG_NS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('style', 'position:absolute;width:0;height:0;visibility:hidden;pointer-events:none;')
  document.body.appendChild(svg)
  let result: Array<Array<[number, number][]>>
  try {
    result = states.map((state) =>
      (state.paths ?? []).map((p) => {
        const path = document.createElementNS(SVG_NS, 'path')
        path.setAttribute('d', p.d)
        svg.appendChild(path)
        const sampled = samplePath(path, samples)
        svg.removeChild(path)
        return sampled
      }),
    )
  } finally {
    document.body.removeChild(svg)
  }
  if (result.length > 1) {
    const reference = result[0]
    for (let s = 1; s < result.length; s++) {
      for (let pi = 0; pi < result[s].length; pi++) {
        const ref = reference[pi]
        if (ref && ref.length === result[s][pi].length) {
          result[s][pi] = alignSamples(ref, result[s][pi])
        }
      }
    }
  }
  return result
}

export function pointsToPathD(points: [number, number][]): string {
  if (points.length === 0) return ''
  let d = `M${points[0][0].toFixed(3)},${points[0][1].toFixed(3)}`
  for (let i = 1; i < points.length; i++) {
    d += `L${points[i][0].toFixed(3)},${points[i][1].toFixed(3)}`
  }
  return `${d}Z`
}

export function lerpPoints(
  a: [number, number][],
  b: [number, number][],
  t: number,
): [number, number][] {
  if (a.length !== b.length) return t < 0.5 ? a : b
  return a.map(([ax, ay], i) => {
    const [bx, by] = b[i]
    return [ax + (bx - ax) * t, ay + (by - ay) * t]
  })
}

export function tokenize(token: string): string {
  return token.replace(/\./g, '-')
}

export const THEMABLE_TOKENS = new Set<string>([
  'bg-base', 'bg-surface', 'bg-elevated', 'bg-overlay',
  'text-primary', 'text-secondary', 'text-tertiary',
  'accent', 'accent-true-acc', 'accent-standard-acc', 'accent-tech-acc',
  'accent-low-mid', 'accent-overall',
  'tint-true-acc', 'tint-standard-acc', 'tint-tech-acc',
  'tint-low-mid', 'tint-overall',
  'success', 'warning', 'error', 'info',
  'diff-easy', 'diff-normal', 'diff-hard', 'diff-expert', 'diff-expert-plus',
  'tier-bronze', 'tier-silver', 'tier-gold', 'tier-platinum',
  'tier-diamond', 'tier-apex',
  'tier-newcomer', 'tier-apprentice', 'tier-adept', 'tier-skilled',
  'tier-expert', 'tier-master', 'tier-grandmaster', 'tier-legend',
  'tier-transcendent', 'tier-mythic', 'tier-ascendant',
  'role-admin', 'role-developer', 'role-moderator',
  'role-head-ranking', 'role-ranking',
  'chart-grid', 'chart-text',
  'skeleton-base', 'skeleton-highlight',
  'navbar-bg', 'navbar-bg-scrolled', 'navbar-text', 'navbar-text-strong',
])

export function filterThemableTokens(tokens: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, val] of Object.entries(tokens)) {
    const normalized = tokenize(key)
    if (THEMABLE_TOKENS.has(normalized)) {
      out[normalized] = val
    } else if (import.meta.env.DEV && !normalized.startsWith('fx-') && normalized !== 'base') {
      console.warn(`[theme] ignoring non-themable token "${key}"`)
    }
  }
  return out
}

export function themeTokensToCssVars(tokens: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, val] of Object.entries(filterThemableTokens(tokens))) {
    out[`--${key}`] = val
  }
  return out
}

export function applyThemeTokens(tokens: Record<string, string>): void {
  const root = document.documentElement
  for (const [key, val] of Object.entries(filterThemableTokens(tokens))) {
    root.style.setProperty(`--${key}`, val)
  }
}

export function clearThemeTokens(tokens: Record<string, string>): void {
  const root = document.documentElement
  for (const key of Object.keys(tokens)) {
    root.style.removeProperty(`--${tokenize(key)}`)
  }
}

