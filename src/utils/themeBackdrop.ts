export interface StarfieldBackdropConfig {
  type: 'starfield'
  opacity: number
  starColor: string
  starDensity: number
  shooting: boolean
  shootingMinMs: number
  shootingMaxMs: number
  comets: boolean
  cometMinMs: number
  cometMaxMs: number
  nebulas: boolean
  nebulaCount: number
  nebulaColors: string[]
  nebulaOpacity: number
  nebulaSize: number
}

export interface PixelFieldBackdropConfig {
  type: 'pixel_field'
  opacity: number
  pixelSize: number
  fieldHeightPct: number
  fieldRows: number
  wheatColors: string[]
  skyColors: string[]
  sunColor: string
  leaves: boolean
  leafColors: string[]
  birds: boolean
  birdColor: string
  windSpeed: number
}

export interface ForestBackdropConfig {
  type: 'forest'
  opacity: number
  pixelSize: number
  canopyColors: string[]
  treeColors: string[]
  groundColors: string[]
  pathColor: string
  mushroomColors: string[]
  wisps: boolean
  wispColors: string[]
  fireflies: boolean
  fireflyColor: string
  eyes: boolean
  eyeColors: string[]
  spores: boolean
  bloom: boolean
  driftSpeed: number
}

export type ThemeBackdropConfig =
  | StarfieldBackdropConfig
  | PixelFieldBackdropConfig
  | ForestBackdropConfig

export type ThemeBackdropType = ThemeBackdropConfig['type']

const HEX_RE = /^#[0-9a-f]{6}$/i

function readNumber(tokens: Record<string, string>, key: string, fallback: number): number {
  const v = parseFloat(tokens[key] ?? '')
  return Number.isFinite(v) ? v : fallback
}

function readFlag(tokens: Record<string, string>, key: string, fallback: boolean): boolean {
  const v = tokens[key]
  if (v === undefined) return fallback
  return v === '1' || v === 'true'
}

function readHex(tokens: Record<string, string>, key: string, fallback: string): string {
  const v = tokens[key]
  return v && HEX_RE.test(v) ? v : fallback
}

function readHexList(tokens: Record<string, string>, key: string, fallback: string[]): string[] {
  const v = tokens[key]
  if (!v) return fallback
  const list = v.split(',').map((s) => s.trim()).filter((s) => HEX_RE.test(s))
  return list.length ? list : fallback
}

function readOpacity(tokens: Record<string, string>): number {
  const v = readNumber(tokens, 'fx-backdrop-opacity', 1)
  return Math.min(1, Math.max(0.05, v))
}

function parseStarfield(tokens: Record<string, string>): StarfieldBackdropConfig {
  return {
    type: 'starfield',
    opacity: readOpacity(tokens),
    starColor: readHex(tokens, 'fx-star-color', '#dbe4ff'),
    starDensity: readNumber(tokens, 'fx-star-density', 1),
    shooting: readFlag(tokens, 'fx-shooting', false),
    shootingMinMs: readNumber(tokens, 'fx-shooting-min-s', 2.5) * 1000,
    shootingMaxMs: readNumber(tokens, 'fx-shooting-max-s', 6.5) * 1000,
    comets: readFlag(tokens, 'fx-comets', false),
    cometMinMs: readNumber(tokens, 'fx-comet-min-s', 25) * 1000,
    cometMaxMs: readNumber(tokens, 'fx-comet-max-s', 55) * 1000,
    nebulas: readFlag(tokens, 'fx-nebulas', false),
    nebulaCount: readNumber(tokens, 'fx-nebula-count', 3),
    nebulaColors: readHexList(tokens, 'fx-nebula-colors', ['#312e81', '#155e75', '#4a1d6e']),
    nebulaOpacity: readNumber(tokens, 'fx-nebula-opacity', 0.08),
    nebulaSize: readNumber(tokens, 'fx-nebula-size', 1),
  }
}

function parsePixelField(tokens: Record<string, string>): PixelFieldBackdropConfig {
  return {
    type: 'pixel_field',
    opacity: readOpacity(tokens),
    pixelSize: readNumber(tokens, 'fx-field-pixel-size', 5),
    fieldHeightPct: readNumber(tokens, 'fx-field-height-pct', 13),
    fieldRows: Math.max(1, Math.round(readNumber(tokens, 'fx-field-rows', 3))),
    wheatColors: readHexList(tokens, 'fx-field-wheat-colors', ['#d69a24', '#e0a82e', '#c9861d']),
    skyColors: readHexList(tokens, 'fx-field-sky-colors', ['#7d6bb8', '#b56aa8', '#e06a9f', '#e88a52', '#cf8f1f']),
    sunColor: readHex(tokens, 'fx-field-sun-color', '#f5b800'),
    leaves: readFlag(tokens, 'fx-field-leaves', false),
    leafColors: readHexList(tokens, 'fx-field-leaf-colors', ['#e0a82e', '#f472b6', '#d69a24']),
    birds: readFlag(tokens, 'fx-field-birds', false),
    birdColor: readHex(tokens, 'fx-field-bird-color', '#3d1f2e'),
    windSpeed: readNumber(tokens, 'fx-field-wind', 1),
  }
}

function parseForest(tokens: Record<string, string>): ForestBackdropConfig {
  return {
    type: 'forest',
    opacity: readOpacity(tokens),
    pixelSize: readNumber(tokens, 'fx-forest-pixel-size', 5),
    canopyColors: readHexList(tokens, 'fx-forest-canopy-colors', ['#04060a', '#050b11', '#071118', '#08171c']),
    treeColors: readHexList(tokens, 'fx-forest-tree-colors', ['#1c2624', '#231710', '#120a06']),
    groundColors: readHexList(tokens, 'fx-forest-ground-colors', ['#081410', '#0a1c16', '#0d231b']),
    pathColor: readHex(tokens, 'fx-forest-path-color', '#1a382b'),
    mushroomColors: readHexList(tokens, 'fx-forest-mushroom-colors', ['#60a5fa', '#5eead4', '#c084fc']),
    wisps: readFlag(tokens, 'fx-forest-wisps', false),
    wispColors: readHexList(tokens, 'fx-forest-wisp-colors', ['#93c5fd', '#a5f3fc', '#ddd6fe']),
    fireflies: readFlag(tokens, 'fx-forest-fireflies', false),
    fireflyColor: readHex(tokens, 'fx-forest-firefly-color', '#d9f99d'),
    eyes: readFlag(tokens, 'fx-forest-eyes', false),
    eyeColors: readHexList(tokens, 'fx-forest-eye-colors', ['#fbbf24', '#5eead4', '#f472b6']),
    spores: readFlag(tokens, 'fx-forest-spores', false),
    bloom: readFlag(tokens, 'fx-forest-bloom', false),
    driftSpeed: readNumber(tokens, 'fx-forest-drift', 1),
  }
}

const BACKDROP_PARSERS: Record<string, (tokens: Record<string, string>) => ThemeBackdropConfig> = {
  starfield: parseStarfield,
  pixel_field: parsePixelField,
  forest: parseForest,
}

export function readBackdropConfig(
  tokens: Record<string, string> | null | undefined,
): ThemeBackdropConfig | null {
  if (!tokens) return null
  const parse = BACKDROP_PARSERS[tokens['fx-backdrop'] ?? '']
  return parse ? parse(tokens) : null
}
