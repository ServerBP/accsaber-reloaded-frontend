import type { PaginationParams } from '../pagination'

export type ItemSource =
  | 'milestone'
  | 'milestone_set'
  | 'campaign_milestone'
  | 'campaign_difficulty'
  | 'campaign_completion'
  | 'level'
  | 'trade'
  | 'manual'
  | 'crate_drop'
  | 'supporter_tier'

export type KnownItemTypeKey =
  | 'badge'
  | 'title'
  | 'profile_border'
  | 'profile_border_shape'
  | 'profile_border_color'
  | 'theme'
  | 'profile_visual'
  | 'profile_background'
  | 'profile_thumbnail_background'
  | 'statistic'
  | 'perk'

export type ItemTypeKey = KnownItemTypeKey | (string & {})

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'

export type Easing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | (string & {})

export type Loop = 'loop' | 'pingpong' | 'once'

export interface GradientStop {
  atPct: number
  hex: string
}

export type Gradient =
  | { type: 'linear'; angleDeg: number; stops: GradientStop[] }
  | { type: 'radial'; centerXPct?: number; centerYPct?: number; radiusPct?: number; stops: GradientStop[] }
  | { type: 'conic'; centerXPct?: number; centerYPct?: number; angleDeg?: number; stops: GradientStop[] }

export interface VisualEffect {
  type: string
  [param: string]: unknown
}

export interface AssetSet {
  svg?: string
  raster?: { '1x'?: string; '2x'?: string; '3x'?: string; '4x'?: string; [k: string]: string | undefined }
  video?: string
  altText: string
}

export interface ModifierEffectSpec {
  contractVersion: 1
  compositions: Composition[]
}

export interface Composition {
  type: string
  [param: string]: unknown
}

export interface ItemModifierRef {
  id: string
  key: string
  name: string
  colorHex: string
  effectSpec: ModifierEffectSpec | null
}

export interface UnusualEffectRef {
  id: string
  key: string
  name: string
  effectSpec: ModifierEffectSpec | null
}

export interface ItemModifierResponse {
  id: string
  key: string
  name: string
  description: string | null
  colorHex: string
  effectSpec: ModifierEffectSpec | null
  globalDropChance: number | null
  seasonStart: string | null
  seasonEnd: string | null
  active: boolean
  createdAt: string
}

export interface ItemTypeResponse {
  id: string
  parentTypeId: string | null
  key: ItemTypeKey
  name: string
  description: string | null
  valueSchema: Record<string, unknown> | null
  active: boolean
  createdAt: string
}

export interface TitleGlistenSpec {
  enabled: boolean
  highlight?: string
  intervalMs?: number
  durationMs?: number
  bandPctOfDiagonal?: number
}

export interface TitleStateValue {
  atMs: number
  color?: string
  gradient?: Gradient
  lightColor?: string
  lightGradient?: Gradient
  fontWeight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900
  fontStyle?: 'normal' | 'italic'
  letterSpacingPx?: number
  effects?: VisualEffect[]
  glisten?: TitleGlistenSpec
}

export type TitleFont = 'pixel_8bit' | (string & {})

export interface TitleFlashSpec {
  enabled: boolean
  color?: string
  lightColor?: string
  minIntervalMs?: number
  maxIntervalMs?: number
  durationMs?: number
}

export type TitleSparkleShape = 'star' | 'paw'

export interface TitleSparkleSpec {
  enabled: boolean
  color?: string
  lightColor?: string
  perSecond?: number
  sizePx?: number
  fadeMs?: number
  shape?: TitleSparkleShape
  spreadPct?: number
}

export type TitleOrnamentIcon = 'yarn_ball' | 'alpha' | (string & {})

export interface TitleOrnamentSpec {
  icon: TitleOrnamentIcon
  color?: string
  lightColor?: string
  sizeEm?: number
}

export interface TitleFlameAuraSpec {
  type: 'flame'
  enabled: boolean
  inner?: string
  outer?: string
  spark?: string
  lightInner?: string
  lightOuter?: string
  lightSpark?: string
}

export interface TitleHazeAuraSpec {
  type: 'haze'
  enabled: boolean
  color?: string
  glow?: string
  lightColor?: string
  lightGlow?: string
}

export interface TitleSmokeAuraSpec {
  type: 'smoke'
  enabled: boolean
  smoke?: string
  ember?: string
  lightSmoke?: string
  lightEmber?: string
}

export type TitleAuraSpec = TitleFlameAuraSpec | TitleHazeAuraSpec | TitleSmokeAuraSpec

export type TitleAuraType = TitleAuraSpec['type']

export interface TitleValue {
  text: string
  font?: TitleFont
  states: TitleStateValue[]
  ornament?: TitleOrnamentSpec
  flashes?: TitleFlashSpec
  sparkles?: TitleSparkleSpec
  aura?: TitleAuraSpec
  variants?: ItemVariant[]
  durationMs?: number
  loop?: Loop
  easing?: Easing
}

export interface BorderShapePathValue {
  d: string
  stroke?: string
  strokeWidth?: number
  fill?: string
  strokeLinecap?: 'butt' | 'round' | 'square'
  strokeLinejoin?: 'miter' | 'round' | 'bevel'
  strokeDasharray?: string
  strokeOpacity?: number
  fillOpacity?: number
  transform?: string
  twinkle?: boolean
}

export interface BorderShapeStateValue {
  atMs: number
  paths?: BorderShapePathValue[]
  filters?: VisualEffect[]
}

export type BorderShapeRenderMode = 'path' | 'pixel'

export type BorderShapeMotif = 'heart_climb' | (string & {})

export interface ShapeSparkleSpec {
  enabled: boolean
  perSecond?: number
  sizePx?: number
  fadeMs?: number
}

export interface ShapeGlistenSpec {
  enabled: boolean
  intervalMs?: number
  durationMs?: number
  bandPctOfDiagonal?: number
}

export type PaletteStopName =
  | 'outline'
  | 'deepShadow'
  | 'shadow'
  | 'midShadow'
  | 'base'
  | 'midHighlight'
  | 'highlight'
  | 'apexHighlight'

export type PaletteDerivationOp =
  | { fn: 'darken'; of: PaletteStopName; amount: number }
  | { fn: 'lighten'; of: PaletteStopName; amount: number }
  | { fn: 'lerp'; from: PaletteStopName; to: PaletteStopName; at: number }

export interface PaletteDerivation {
  outline?: PaletteDerivationOp
  deepShadow?: PaletteDerivationOp
  midShadow?: PaletteDerivationOp
  midHighlight?: PaletteDerivationOp
  apexHighlight?: PaletteDerivationOp
}

export interface FrameRampBand {
  upToPct: number
  stop: PaletteStopName
}

export interface FrameRampSpec {
  angleDeg: number
  bands: FrameRampBand[]
}

export interface FrameStreaksPatternStep {
  stop: PaletteStopName | null
  lengthPx: number
}

export interface FrameStreaksSpec {
  angleDeg: number
  blendMode?: string
  pattern: FrameStreaksPatternStep[]
}

export interface FrameSpec {
  thicknessProportional?: number
  thicknessMinPx?: number
  thicknessMaxPx?: number
  cornerRadiusProportional?: number
  cornerRadiusMinPx?: number
  outlineWidthPx?: number
  ramp?: FrameRampSpec
  streaks?: FrameStreaksSpec
}

export type AvatarFit = 'cover' | 'safe'

export interface BorderDecal {
  viewBox: string
  paths: BorderShapePathValue[]
  xPct: number
  yPct: number
  sizePct: number
  rotateDeg?: number
  opacity?: number
  pulse?: { periodMs?: number; scaleAmp?: number }
}

export interface BorderRainOverlaySpec {
  type: 'rain'
  enabled: boolean
  color?: string
  drops?: number
  splash?: boolean
  puddle?: boolean
}

export interface BorderBlackHoleOverlaySpec {
  type: 'blackhole'
  enabled: boolean
  glow?: string
  suction?: {
    fillType: 'cosmic'
  }
  vortex?: {
    maxLuminance: number
    color?: string
    arms?: number
  }
}

export interface BorderArcadeOverlaySpec {
  type: 'arcade'
  enabled: boolean
  invader?: string
  ship?: string
  bullet?: string
  burst?: string
  hp?: string
  mp?: string
  symbols?: string[]
  hudBg?: string
  hudEdge?: string
  hudGloss?: string
  barBg?: string
  hpLabel?: string
  hpEmpty?: string
  mpLabel?: string
  mpEmpty?: string
}

export type ThermalPalette = 'ironbow' | 'whitehot' | 'nightvision'

export interface BorderThermalOverlaySpec {
  type: 'thermal'
  enabled: boolean
  intervalMs?: number
  holdMs?: number
  palette?: ThermalPalette
  led?: string
  hud?: string
  window?: { x: number; y: number; w: number; h: number }
}

export interface BorderBlueprintOverlaySpec {
  type: 'blueprint'
  enabled: boolean
  draft?: string
  draftDim?: string
  pivot?: { x: number; y: number }
  mirror?: boolean
  radius?: number
  sweepFromDeg?: number
  sweepToDeg?: number
  periodMs?: number
  dim?: { x1: number; y1: number; x2: number; y2: number }
}

export type BorderOverlaySpec =
  | BorderRainOverlaySpec
  | BorderBlackHoleOverlaySpec
  | BorderArcadeOverlaySpec
  | BorderThermalOverlaySpec
  | BorderBlueprintOverlaySpec

export type BorderOverlayType = BorderOverlaySpec['type']

export interface BorderShapeValue {
  viewBox?: string
  avatarMask?: string
  avatarFit?: AvatarFit
  decals?: BorderDecal[]
  overlay?: BorderOverlaySpec
  renderMode?: BorderShapeRenderMode
  pixelSize?: number
  motif?: BorderShapeMotif
  frame?: FrameSpec
  paletteDerivation?: PaletteDerivation
  sparkles?: ShapeSparkleSpec
  glisten?: ShapeGlistenSpec
  states: BorderShapeStateValue[]
  variants?: ItemVariant[]
  durationMs?: number
  loop?: Loop
  easing?: Easing
}

export interface PixelMetalFill {
  type: 'pixel_metal'
  base: string
  highlight: string
  shadow: string
}

export interface CosmicFill {
  type: 'cosmic'
  space: string
  star: string
  nebulas: string[]
  accent: string
  planets?: boolean
  blackHoles?: boolean
  comets?: boolean
  shooting?: boolean
  speed?: number
}

export interface ToonFill {
  type: 'toon'
  ink: string
  line: string
  staticFps?: number
  staticCell?: number
  staticAlpha?: number
}

export type BorderColorFill =
  | { type: 'solid'; hex: string }
  | Gradient
  | PixelMetalFill
  | CosmicFill
  | ToonFill

export interface BorderColorStateValue {
  atMs: number
  fill: BorderColorFill
  filters?: VisualEffect[]
}

export interface ItemVariant {
  key: string
  label: string
  [override: string]: unknown
}

export interface BorderColorValue {
  states: BorderColorStateValue[]
  variants?: ItemVariant[]
  durationMs?: number
  loop?: Loop
  easing?: Easing
}

export interface BadgeValue {
  asset: AssetSet
  tint?: string
  effects?: VisualEffect[]
}

export type BackgroundFit = 'cover' | 'contain' | 'tile' | 'center'

export type BackgroundBlendMode =
  | 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten'
  | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light'
  | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity'

export interface ProfileBackgroundValue {
  asset: AssetSet
  fit?: BackgroundFit
  opacity?: number
  blendMode?: BackgroundBlendMode
  filters?: VisualEffect[]
  parallax?: { depth?: number; [k: string]: unknown }
}

export interface ProfileThumbnailBackgroundValue {
  asset: AssetSet
  fit?: BackgroundFit
  opacity?: number
  blendMode?: 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten'
}

export interface ThemeValue {
  tokens: Record<string, string>
  altTokens?: Record<string, string>
}

export interface StatisticValue {
  statKey: string
  label: string
  icon?: string
  format?: {
    type: 'integer' | 'decimal' | 'duration' | 'percent' | 'custom'
    decimals?: number
    suffix?: string
    prefix?: string
  }
}

export interface PerkValue {
  effect: string
  amount?: number
}

export type ItemValue =
  | TitleValue
  | BorderShapeValue
  | BorderColorValue
  | BadgeValue
  | ProfileBackgroundValue
  | ProfileThumbnailBackgroundValue
  | ThemeValue
  | StatisticValue
  | PerkValue

export interface ItemResponse {
  id: string
  typeId: string
  typeKey: ItemTypeKey
  name: string
  description: string | null
  iconUrl: string | null
  value: ItemValue | null
  rarity: ItemRarity
  tradeable: boolean
  visible: boolean
  active: boolean
  deprecated: boolean
  stackable: boolean
  welcomeGrant: boolean
  missionPoolable: boolean
  unlockLevel: number | null
  worth: number | null
  requirement: string | null
  createdAt: string
}

export interface CrateContentResponse {
  rewardItem: ItemResponse
  dropWeight: number
  dropChance: number
}

export interface CrateModifierResponse {
  modifier: ItemModifierRef
  dropChance: number
}

export interface CrateOpenResponse {
  id: string
  crate: ItemResponse
  consumedLinkId: string
  reward: UserItemResponse
  rolledAt: string
}

export interface UnusualEffectResponse extends UnusualEffectRef {
  description: string | null
  active: boolean
  createdAt: string
}

export interface CreateUnusualEffectRequest {
  key: string
  name: string
  description?: string | null
  effectSpec: ModifierEffectSpec
}

export interface UpdateUnusualEffectRequest {
  name?: string | null
  description?: string | null
  effectSpec?: ModifierEffectSpec | null
}

export interface UserItemResponse {
  linkId: string
  item: ItemResponse
  modifiers: ItemModifierRef[]
  unusualEffect: UnusualEffectRef | null
  serialNumber: number | null
  quantity: number
  source: ItemSource
  sourceId: string | null
  awardedByStaffId: string | null
  reason: string | null
  awardedAt: string
  variantKey?: string | null
}

export type EquippedItemsResponse = Partial<Record<ItemTypeKey, UserItemResponse | null>>

export interface DisintegrationResponse {
  linkId: string
  itemId: string
  quantityDisintegrated: number
  remainingQuantity: number | null
  essenceGained: number
  balance: number
}

export interface EssenceBalance {
  balance: number
}

export interface ItemListParams {
  typeId?: string
  tradeable?: boolean
}

export interface AdminItemListParams extends ItemListParams {
  includeInactive?: boolean
}

export interface AdminItemTypeListParams {
  includeInactive?: boolean
}

export interface UserItemListParams {
  typeKey?: ItemTypeKey
}

export interface InventoryListParams extends PaginationParams {
  typeKey?: ItemTypeKey
  rarity?: ItemRarity
  modifierKey?: string | string[]
  tradeable?: boolean
  search?: string
}

export interface CreateItemTypeRequest {
  parentTypeId?: string
  key: string
  name: string
  description?: string
  valueSchema?: Record<string, unknown>
}

export interface UpdateItemTypeRequest {
  name?: string
  description?: string
  valueSchema?: Record<string, unknown>
}

export interface CreateItemRequest {
  typeId: string
  name: string
  description?: string
  iconUrl?: string
  value?: Record<string, unknown>
  tradeable?: boolean
  visible?: boolean
  rarity?: ItemRarity
  stackable?: boolean
  welcomeGrant?: boolean
  missionPoolable?: boolean
  active?: boolean
  worth?: number | null
  requirement?: string | null
  unlockLevel?: number | null
}

export interface UpdateItemRequest {
  name?: string
  description?: string
  iconUrl?: string
  value?: Record<string, unknown>
  tradeable?: boolean
  visible?: boolean
  rarity?: ItemRarity
  stackable?: boolean
  welcomeGrant?: boolean
  missionPoolable?: boolean
  worth?: number | null
  requirement?: string | null
  unlockLevel?: number | null
}

export interface AwardItemRequest {
  userId: string
  itemId: string
  reason?: string
  modifierKeys?: string[]
  unusualEffectId?: string
  quantity?: number
}

export interface EquipItemRequest {
  linkId: string
  variantKey?: string
}

export interface PatchItemModifierRequest {
  globalDropChance: number | null
  seasonStart: string | null
  seasonEnd: string | null
}

export interface PutCrateModifierRequest {
  dropChance: number
}
