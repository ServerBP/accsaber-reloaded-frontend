const STOPS = [
  { at: 0, token: '--complexity-0' },
  { at: 3, token: '--complexity-3' },
  { at: 6, token: '--complexity-6' },
  { at: 8, token: '--complexity-8' },
  { at: 10, token: '--complexity-10' },
  { at: 14, token: '--complexity-14' },
] as const

export const COMPLEXITY_MAX = STOPS[STOPS.length - 1].at

function gradient(alpha?: number): string {
  const stops = STOPS.map((stop) => {
    const color =
      alpha === undefined
        ? `var(${stop.token})`
        : `color-mix(in srgb, var(${stop.token}) ${alpha}%, transparent)`
    return `${color} ${((stop.at / COMPLEXITY_MAX) * 100).toFixed(3)}%`
  })
  return `linear-gradient(90deg, ${stops.join(', ')})`
}

export const COMPLEXITY_GRADIENT = gradient()
export const COMPLEXITY_GRADIENT_GHOST = gradient(16)

export function complexityColor(complexity: number): string {
  const value = clamp(complexity)
  for (let i = STOPS.length - 1; i > 0; i--) {
    const lower = STOPS[i - 1]
    const upper = STOPS[i]
    if (value < lower.at) continue
    const t = (value - lower.at) / (upper.at - lower.at)
    return `color-mix(in srgb, var(${upper.token}) ${(t * 100).toFixed(2)}%, var(${lower.token}))`
  }
  return `var(${STOPS[0].token})`
}

export function complexityPercent(complexity: number): number {
  return (clamp(complexity) / COMPLEXITY_MAX) * 100
}

function clamp(complexity: number): number {
  if (!Number.isFinite(complexity)) return 0
  return Math.min(Math.max(complexity, 0), COMPLEXITY_MAX)
}
