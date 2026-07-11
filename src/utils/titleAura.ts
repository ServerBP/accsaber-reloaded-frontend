export const TITLE_AURA_PAD = { x: 0.9, top: 1.7, bottom: 0.55 } as const

export interface TitleAuraRect {
  x: number
  y: number
  w: number
  h: number
  fs: number
}

export function titleAuraRect(canvas: HTMLCanvasElement): TitleAuraRect {
  const fs = parseFloat(getComputedStyle(canvas).fontSize) || 12
  return {
    x: TITLE_AURA_PAD.x * fs,
    y: TITLE_AURA_PAD.top * fs,
    w: canvas.clientWidth - 2 * TITLE_AURA_PAD.x * fs,
    h: canvas.clientHeight - (TITLE_AURA_PAD.top + TITLE_AURA_PAD.bottom) * fs,
    fs,
  }
}
