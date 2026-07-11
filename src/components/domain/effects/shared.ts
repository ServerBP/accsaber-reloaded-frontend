export { hash01 } from '@/utils/random'

export interface OverlayBox {
  w: number
  h: number
}

export interface ContentBox {
  x: number
  y: number
  w: number
  h: number
}

export interface EffectMeasure {
  overlayBox: OverlayBox
  box: ContentBox
  stack: number
}

export function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

export function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined
}

export function boxScale(minD: number, min = 0.7): number {
  return Math.max(min, Math.min(1.8, minD / 140))
}
