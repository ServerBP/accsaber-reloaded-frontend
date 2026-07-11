export const ESSENCE_GLYPH = '✦'

export function formatEssenceAmount(amount: number): string {
  return Math.max(0, Math.round(amount)).toLocaleString()
}

export function formatEssence(amount: number): string {
  return `${formatEssenceAmount(amount)} ${ESSENCE_GLYPH}`
}
