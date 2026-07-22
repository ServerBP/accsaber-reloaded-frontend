export const ESSENCE_GLYPH = '✦'

export function formatEssenceAmount(amount: number): string {
  return Math.max(0, Math.round(amount)).toLocaleString()
}

export function formatEssence(amount: number): string {
  return `${formatEssenceAmount(amount)} ${ESSENCE_GLYPH}`
}

export function formatEssenceNet(net: number): string {
  if (net === 0) return 'You break even on essence'
  const sign = net > 0 ? '+' : '-'
  return `You net ${sign}${formatEssenceAmount(Math.abs(net))} essence`
}
